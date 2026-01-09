import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from './rateLimiter.js';

/**
 * Public API: Get changelog entries for a workspace
 * Endpoint: /api/public/changelog
 * Method: POST
 * Auth: None required
 * 
 * Request: {
 *   workspace_id: string,
 *   limit?: number,
 *   offset?: number
 * }
 * 
 * Response: {
 *   items: Array<{
 *     id: string,
 *     workspace_id: string,
 *     title: string,
 *     description: string,
 *     release_date: string,
 *     tags: string[]
 *   }>,
 *   total: number
 * }
 */
Deno.serve(async (req) => {
  try {
    // Apply rate limiting (60 req/min per IP)
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;
    
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { workspace_id, limit = 50, offset = 0 } = payload;

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

    // Fetch changelog entries (only public)
    const allEntries = await base44.asServiceRole.entities.ChangelogEntry.filter({
      workspace_id,
      visibility: 'public'
    }, '-release_date');

    const total = allEntries.length;
    const entries = allEntries.slice(offset, offset + limit);

    // Return whitelisted fields only
    const publicEntries = entries.map(entry => ({
      id: entry.id,
      workspace_id: entry.workspace_id,
      title: entry.title,
      description: entry.description || '',
      release_date: entry.release_date,
      tags: entry.tags || []
    }));

    const response = Response.json({
      items: publicEntries,
      total
    });
    
    // Cache for 5 minutes (changelog changes infrequently)
    return addCacheHeaders(response, 300);

  } catch (error) {
    console.error('Public changelog fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});