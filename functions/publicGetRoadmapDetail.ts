import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Public API: Get single roadmap item details
 * Endpoint: /api/public/roadmap/:id
 * Method: POST
 * Auth: None required
 * 
 * Request: {
 *   item_id: string,
 *   workspace_id: string
 * }
 * 
 * Response: {
 *   id: string,
 *   workspace_id: string,
 *   title: string,
 *   description: string,
 *   status: string,
 *   target_date?: string,
 *   target_quarter?: string,
 *   tags: string[],
 *   display_order: number,
 *   updates: Array<{
 *     id: string,
 *     content: string,
 *     update_type: string,
 *     created_date: string
 *   }>
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { item_id, workspace_id } = payload;

    if (!item_id || !workspace_id) {
      return Response.json({ error: 'item_id and workspace_id are required' }, { status: 400 });
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

    // Fetch roadmap item
    const items = await base44.asServiceRole.entities.RoadmapItem.filter({ 
      id: item_id,
      workspace_id,
      visibility: 'public'
    });

    if (items.length === 0) {
      return Response.json({ error: 'Roadmap item not found or not public' }, { status: 404 });
    }

    const item = items[0];

    // Fetch updates
    const updates = await base44.asServiceRole.entities.RoadmapUpdate.filter({
      roadmap_item_id: item_id,
      workspace_id
    }, '-created_date');

    // Return whitelisted fields
    return Response.json({
      id: item.id,
      workspace_id: item.workspace_id,
      title: item.title,
      description: item.description || '',
      status: item.status,
      target_date: item.target_date || null,
      target_quarter: item.target_quarter || null,
      tags: item.tags || [],
      display_order: item.display_order || 0,
      updates: updates.map(u => ({
        id: u.id,
        content: u.content,
        update_type: u.update_type,
        created_date: u.created_date,
        author_label: `${workspaces[0].name} Team`
      }))
    });

  } catch (error) {
    console.error('Public roadmap detail fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});