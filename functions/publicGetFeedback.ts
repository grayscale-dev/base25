import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from './rateLimiter.js';

/**
 * Public API: Get feedback items for a workspace
 * Endpoint: /api/public/feedback
 * Method: POST
 * Auth: None required
 * 
 * Request: {
 *   workspace_id: string,
 *   type?: string,
 *   status?: string,
 *   limit?: number,
 *   offset?: number
 * }
 * 
 * Response: {
 *   items: Array<{
 *     id: string,
 *     workspace_id: string,
 *     title: string,
 *     type: string,
 *     description: string,
 *     status: string,
 *     tags: string[],
 *     vote_count: number,
 *     response_count: number,
 *     created_date: string,
 *     submitter_email: string (anonymized)
 *   }>,
 *   total: number
 * }
 */
Deno.serve(async (req) => {
  try {
    // Apply rate limiting (60 req/min per IP)
    const rateLimitResponse = applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;
    
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { workspace_id, type, status, limit = 50, offset = 0 } = payload;

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
      visibility: 'public' // Only public feedback
    };

    if (type) filter.type = type;
    if (status) filter.status = status;

    // Fetch feedback items
    const allFeedback = await base44.asServiceRole.entities.Feedback.filter(filter, '-created_date');
    const total = allFeedback.length;
    const items = allFeedback.slice(offset, offset + limit);

    // Fetch response counts (excluding internal notes)
    const allResponses = await base44.asServiceRole.entities.FeedbackResponse.filter({
      workspace_id
    });
    const responseCounts = {};
    allResponses.forEach(r => {
      if (!r.is_internal_note) {
        responseCounts[r.feedback_id] = (responseCounts[r.feedback_id] || 0) + 1;
      }
    });

    // Return whitelisted fields only
    const publicItems = items.map(item => ({
      id: item.id,
      workspace_id: item.workspace_id,
      title: item.title,
      type: item.type,
      description: item.description,
      status: item.status,
      tags: item.tags || [],
      vote_count: item.vote_count || 0,
      response_count: responseCounts[item.id] || 0,
      created_date: item.created_date,
      author_display_name: 'Community Member'
    }));

    const response = Response.json({
      items: publicItems,
      total
    });
    
    // Cache for 2 minutes (feedback list changes frequently)
    return addCacheHeaders(response, 120);

  } catch (error) {
    console.error('Public feedback fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});