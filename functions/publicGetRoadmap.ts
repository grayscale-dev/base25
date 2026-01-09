import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from './rateLimiter.js';

/**
 * Public API: Get roadmap items for a workspace
 * Endpoint: /api/public/roadmap
 * Method: POST
 * Auth: None required
 * 
 * Request: {
 *   workspace_id: string,
 *   status?: string
 * }
 * 
 * Response: {
 *   items: Array<{
 *     id: string,
 *     workspace_id: string,
 *     title: string,
 *     description: string,
 *     status: string,
 *     target_date?: string,
 *     target_quarter?: string,
 *     tags: string[],
 *     display_order: number
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
    const { workspace_id, status } = payload;

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
      visibility: 'public' // Only public roadmap items
    };

    if (status) filter.status = status;

    // Fetch roadmap items
    const items = await base44.asServiceRole.entities.RoadmapItem.filter(filter, 'display_order');

    // Return whitelisted fields only
    const publicItems = items.map(item => ({
      id: item.id,
      workspace_id: item.workspace_id,
      title: item.title,
      description: item.description || '',
      status: item.status,
      target_date: item.target_date || null,
      target_quarter: item.target_quarter || null,
      tags: item.tags || [],
      display_order: item.display_order || 0
    }));

    const response = Response.json({
      items: publicItems
    });
    
    // Cache for 3 minutes (roadmap list changes with item updates)
    return addCacheHeaders(response, 180);

  } catch (error) {
    console.error('Public roadmap fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});