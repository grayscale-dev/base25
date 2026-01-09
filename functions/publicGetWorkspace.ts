import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from './rateLimiter.js';

/**
 * Public API: Get workspace info by slug
 * Endpoint: /api/public/workspace/:slug
 * Method: GET
 * Auth: None required
 * 
 * Response: {
 *   id: string,
 *   name: string,
 *   slug: string,
 *   description: string,
 *   logo_url: string,
 *   primary_color: string,
 *   visibility: "public",
 *   support_enabled: boolean
 * }
 */
Deno.serve(async (req) => {
  try {
    // Apply rate limiting (60 req/min per IP)
    const rateLimitResponse = applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;
    
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const payload = await req.json();
    const { slug } = payload;

    if (!slug) {
      return Response.json({ error: 'Workspace slug is required' }, { status: 400 });
    }

    // Query workspace by slug
    const workspaces = await base44.asServiceRole.entities.Workspace.filter({ 
      slug, 
      status: 'active' 
    });

    if (workspaces.length === 0) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspace = workspaces[0];

    // Enforce public visibility
    if (workspace.visibility !== 'public') {
      return Response.json({ error: 'This workspace is not publicly accessible' }, { status: 403 });
    }

    // Return whitelisted fields only
    const response = Response.json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description || '',
      logo_url: workspace.logo_url || '',
      primary_color: workspace.primary_color || '#0f172a',
      visibility: workspace.visibility,
      support_enabled: workspace.support_enabled || false
    });
    
    // Cache for 5 minutes (workspace metadata rarely changes)
    return addCacheHeaders(response, 300);

  } catch (error) {
    console.error('Public workspace fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});