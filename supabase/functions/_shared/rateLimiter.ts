const ipBuckets = new Map<string, number[]>();
const sessionBuckets = new Map<string, number[]>();

function getClientIP(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  return req.headers.get("cf-connecting-ip") || "unknown";
}

export const RATE_LIMITS = {
  PUBLIC_API: {
    windowMs: 60000,
    maxRequests: 60,
    burst: 10,
  },
  ANALYTICS: {
    windowMs: 300000,
    maxRequests: 1,
    burst: 1,
  },
  SIGNUP: {
    windowMs: 60000,
    maxRequests: 3,
    burst: 1,
  },
};

function pruneTimestamps(
  timestamps: number[],
  windowStart: number,
): number[] {
  return timestamps.filter((timestamp) => timestamp > windowStart);
}

async function checkIPLimit(ip: string, config: typeof RATE_LIMITS.PUBLIC_API) {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const burstWindowStart = now - 10000;

  const timestamps = pruneTimestamps(ipBuckets.get(ip) ?? [], windowStart);

  if (timestamps.length >= config.maxRequests) {
    const oldestRequest = timestamps[0];
    const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
    ipBuckets.set(ip, timestamps);
    return {
      allowed: false,
      retryAfter,
      remaining: 0,
      limit: config.maxRequests,
    };
  }

  const recent = timestamps.filter((ts) => ts > burstWindowStart);
  if (recent.length >= config.burst) {
    ipBuckets.set(ip, timestamps);
    return {
      allowed: false,
      retryAfter: 10,
      remaining: 0,
      limit: config.maxRequests,
      burstExceeded: true,
    };
  }

  timestamps.push(now);
  ipBuckets.set(ip, timestamps);
  return {
    allowed: true,
    remaining: config.maxRequests - timestamps.length,
    limit: config.maxRequests,
    retryAfter: null,
  };
}

async function checkSessionLimit(
  sessionId: string,
  identifier: string,
  config: typeof RATE_LIMITS.PUBLIC_API,
) {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = `${sessionId}:${identifier}`;
  const timestamps = pruneTimestamps(sessionBuckets.get(key) ?? [], windowStart);

  if (timestamps.length >= config.maxRequests) {
    const oldestRequest = timestamps[0];
    const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
    sessionBuckets.set(key, timestamps);
    return {
      allowed: false,
      retryAfter,
    };
  }

  timestamps.push(now);
  sessionBuckets.set(key, timestamps);
  return {
    allowed: true,
    retryAfter: null,
  };
}

export async function applyRateLimit(
  req: Request,
  config: typeof RATE_LIMITS.PUBLIC_API,
  options: { sessionId?: string; identifier?: string } = {},
) {
  const ip = getClientIP(req);
  const ipLimit = await checkIPLimit(ip, config);

  if (!ipLimit.allowed) {
    return Response.json(
      {
        error: ipLimit.burstExceeded
          ? "Too many requests in burst. Please slow down."
          : "Rate limit exceeded",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: ipLimit.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": ipLimit.retryAfter.toString(),
          "X-RateLimit-Limit": config.maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": (
            Date.now() +
            ipLimit.retryAfter * 1000
          ).toString(),
        },
      },
    );
  }

  if (options.sessionId && options.identifier) {
    const sessionLimit = await checkSessionLimit(
      options.sessionId,
      options.identifier,
      config,
    );
    if (!sessionLimit.allowed) {
      return Response.json(
        {
          error: "Analytics tracking limit exceeded for this session",
          code: "SESSION_LIMIT_EXCEEDED",
          retryAfter: sessionLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": sessionLimit.retryAfter.toString(),
          },
        },
      );
    }
  }

  return null;
}

export function addCacheHeaders(response: Response, ttlSeconds: number) {
  const headers = new Headers(response.headers);
  headers.set(
    "Cache-Control",
    `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`,
  );
  headers.set(
    "Expires",
    new Date(Date.now() + ttlSeconds * 1000).toUTCString(),
  );
  headers.set("Vary", "Accept-Encoding");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function addNoCacheHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
