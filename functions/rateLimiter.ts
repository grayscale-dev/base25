/**
 * Rate Limiter for Public Endpoints
 * 
 * Uses Deno KV (distributed key-value store) for rate limiting across instances.
 * Provides per-IP rate limiting with burst handling and sliding window.
 */

// Initialize Deno KV store (shared across all instances in Deno Deploy)
const kv = await Deno.openKv();

/**
 * Extract IP address from request
 */
function getClientIP(req) {
  // Check common proxy headers
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback to remote address (Deno Deploy provides this)
  return req.headers.get('cf-connecting-ip') || 'unknown';
}

/**
 * Rate limit configuration presets
 */
export const RATE_LIMITS = {
  // Standard public API - 60 requests per minute per IP
  PUBLIC_API: {
    windowMs: 60000, // 1 minute
    maxRequests: 60,
    burst: 10, // Allow 10 immediate requests
  },
  
  // Analytics tracking - very restrictive
  ANALYTICS: {
    windowMs: 300000, // 5 minutes
    maxRequests: 1, // 1 request per 5 minutes per session+IP combo
    burst: 1,
  },
  
  // Public signup endpoint - moderate
  SIGNUP: {
    windowMs: 60000, // 1 minute
    maxRequests: 3, // 3 signups per minute per IP
    burst: 1,
  },
};

/**
 * Check rate limit for an IP address using Deno KV
 * Uses sliding window algorithm with burst allowance
 */
async function checkIPLimit(ip, config) {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const burstWindowStart = now - 10000; // 10 second burst window
  
  const key = ['ratelimit', 'ip', ip];
  
  // Atomic read-modify-write with Deno KV
  let result;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    const entry = await kv.get(key);
    const requests = entry.value?.requests || [];
    
    // Remove expired requests (sliding window)
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    if (validRequests.length >= config.maxRequests) {
      const oldestRequest = validRequests[0];
      const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
      
      return {
        allowed: false,
        retryAfter,
        remaining: 0,
        limit: config.maxRequests,
      };
    }
    
    // Check burst (recent requests in last 10 seconds)
    const recentRequests = validRequests.filter(timestamp => timestamp > burstWindowStart);
    
    if (recentRequests.length >= config.burst) {
      return {
        allowed: false,
        retryAfter: 10,
        remaining: 0,
        limit: config.maxRequests,
        burstExceeded: true,
      };
    }
    
    // Try to add new request atomically
    validRequests.push(now);
    
    const commitResult = await kv.atomic()
      .check(entry)
      .set(key, { requests: validRequests }, { expireIn: config.windowMs })
      .commit();
    
    if (commitResult.ok) {
      return {
        allowed: true,
        remaining: config.maxRequests - validRequests.length,
        limit: config.maxRequests,
        retryAfter: null,
      };
    }
    
    // Conflict - retry
    attempts++;
  }
  
  // If we fail after retries, fail open (allow request but log)
  console.warn(`Rate limit check failed after ${maxAttempts} attempts for IP: ${ip}`);
  return {
    allowed: true,
    remaining: 0,
    limit: config.maxRequests,
    retryAfter: null,
  };
}

/**
 * Check rate limit for a session (analytics-specific) using Deno KV
 */
async function checkSessionLimit(sessionId, identifier, config) {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = ['ratelimit', 'session', sessionId, identifier];
  
  // Atomic read-modify-write with Deno KV
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    const entry = await kv.get(key);
    const requests = entry.value?.requests || [];
    
    // Remove expired requests
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    if (validRequests.length >= config.maxRequests) {
      const oldestRequest = validRequests[0];
      const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
      
      return {
        allowed: false,
        retryAfter,
      };
    }
    
    // Try to add new request atomically
    validRequests.push(now);
    
    const commitResult = await kv.atomic()
      .check(entry)
      .set(key, { requests: validRequests }, { expireIn: config.windowMs })
      .commit();
    
    if (commitResult.ok) {
      return {
        allowed: true,
        retryAfter: null,
      };
    }
    
    // Conflict - retry
    attempts++;
  }
  
  // Fail open after retries
  console.warn(`Session rate limit check failed after ${maxAttempts} attempts`);
  return {
    allowed: true,
    retryAfter: null,
  };
}

/**
 * Apply rate limiting to a request
 * Returns Response object if rate limit exceeded, null if allowed
 */
export async function applyRateLimit(req, config, options = {}) {
  const ip = getClientIP(req);
  
  // Check IP-based limit
  const ipLimit = await checkIPLimit(ip, config);
  
  if (!ipLimit.allowed) {
    return Response.json({
      error: ipLimit.burstExceeded 
        ? 'Too many requests in burst. Please slow down.'
        : 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: ipLimit.retryAfter,
    }, {
      status: 429,
      headers: {
        'Retry-After': ipLimit.retryAfter.toString(),
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Date.now() + (ipLimit.retryAfter * 1000)).toString(),
      }
    });
  }
  
  // Additional session-based limit for analytics
  if (options.sessionId && options.identifier) {
    const sessionLimit = await checkSessionLimit(options.sessionId, options.identifier, config);
    
    if (!sessionLimit.allowed) {
      return Response.json({
        error: 'Analytics tracking limit exceeded for this session',
        code: 'SESSION_LIMIT_EXCEEDED',
        retryAfter: sessionLimit.retryAfter,
      }, {
        status: 429,
        headers: {
          'Retry-After': sessionLimit.retryAfter.toString(),
        }
      });
    }
  }
  
  // Rate limit passed - return null (no response = continue)
  return null;
}

/**
 * Add cache headers to response
 */
export function addCacheHeaders(response, ttlSeconds) {
  const headers = new Headers(response.headers);
  
  // Public cache with max-age
  headers.set('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
  headers.set('Expires', new Date(Date.now() + (ttlSeconds * 1000)).toUTCString());
  
  // Add ETag for conditional requests
  headers.set('Vary', 'Accept-Encoding');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Add no-cache headers to response
 */
export function addNoCacheHeaders(response) {
  const headers = new Headers(response.headers);
  
  // Explicitly no cache
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
