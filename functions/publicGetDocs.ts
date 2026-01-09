import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from './rateLimiter.js';

/**
 * Public API: Get documentation pages for a workspace
 * Endpoint: /api/public/docs
 * Method: POST
 * Auth: None required
 * 
 * Request: {
 *   workspace_id: string,
 *   parent_id?: string (for nested structure)
 * }
 * 
 * Response: {
 *   pages: Array<{
 *     id: string,
 *     workspace_id: string,
 *     parent_id?: string,
 *     title: string,
 *     slug: string,
 *     type: string,
 *     order: number
 *   }>
 * }
 */
Deno.serve(async (req) => {
  try {
    // Apply rate limiting (60 req/min per IP)
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;
    
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { workspace_id, parent_id } = payload;

    if (!workspace_id) {
      return Response.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Verify workspace is public
    const workspaces = await base44.asServiceRole.entities.Workspace.filter({ 
      id: workspace_id, 
      visibility: 'public',
      status: 'active' 
    });

    if (workspaces.length === 0) {
      return Response.json({ error: 'Workspace not found or not public' }, { status: 404 });
    }

    // Build filter
    const filter = {
      workspace_id,
      is_published: true
    };

    if (parent_id !== undefined) {
      filter.parent_id = parent_id || null;
    }

    // Fetch doc pages
    const pages = await base44.asServiceRole.entities.DocPage.filter(filter, 'order');

    // Return whitelisted fields only (no content in list view)
    const publicPages = pages.map(page => ({
      id: page.id,
      workspace_id: page.workspace_id,
      parent_id: page.parent_id || null,
      title: page.title,
      slug: page.slug,
      type: page.type || 'page',
      order: page.order || 0
    }));

    const response = Response.json({
      pages: publicPages
    });
    
    // Cache for 5 minutes (doc structure changes infrequently)
    return addCacheHeaders(response, 300);

  } catch (error) {
    console.error('Public docs fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});