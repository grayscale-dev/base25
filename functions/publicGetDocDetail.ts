import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from './rateLimiter.js';

/**
 * Public API: Get single doc page with full content
 * Endpoint: /api/public/docs/:slug
 * Method: POST
 * Auth: None required
 * 
 * Request: {
 *   slug: string,
 *   workspace_id: string
 * }
 * 
 * Response: {
 *   id: string,
 *   workspace_id: string,
 *   parent_id?: string,
 *   title: string,
 *   slug: string,
 *   content: string,
 *   content_type: string,
 *   type: string,
 *   order: number
 * }
 */
Deno.serve(async (req) => {
  try {
    // Apply rate limiting (60 req/min per IP)
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;
    
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { slug, workspace_id } = payload;

    if (!slug || !workspace_id) {
      return Response.json({ error: 'slug and workspace_id are required' }, { status: 400 });
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

    // Fetch doc page
    const pages = await base44.asServiceRole.entities.DocPage.filter({ 
      slug,
      workspace_id,
      is_published: true
    });

    if (pages.length === 0) {
      return Response.json({ error: 'Doc page not found or not published' }, { status: 404 });
    }

    const page = pages[0];

    // Return whitelisted fields including content
    const response = Response.json({
      id: page.id,
      workspace_id: page.workspace_id,
      parent_id: page.parent_id || null,
      title: page.title,
      slug: page.slug,
      content: page.content || '',
      content_type: page.content_type || 'markdown',
      type: page.type || 'page',
      order: page.order || 0
    });
    
    // Cache for 5 minutes (docs change infrequently)
    return addCacheHeaders(response, 300);

  } catch (error) {
    console.error('Public doc detail fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});