import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from './rateLimiter.js';

/**
 * Public API: Get single feedback item details with full comment thread
 * Endpoint: /api/public/feedback/:id
 * Method: POST
 * Auth: None required
 * 
 * Request: {
 *   feedback_id: string,
 *   workspace_id: string
 * }
 * 
 * Response: {
 *   id: string,
 *   workspace_id: string,
 *   title: string,
 *   type: string,
 *   description: string,
 *   steps_to_reproduce?: string,
 *   expected_behavior?: string,
 *   actual_behavior?: string,
 *   environment?: object,
 *   attachments: Array<{ name: string, url: string, type: string }>,
 *   status: string,
 *   tags: string[],
 *   vote_count: number,
 *   created_date: string,
 *   submitter_email: string (anonymized),
 *   response_count: number,
 *   responses: Array<{
 *     id: string,
 *     content: string,
 *     is_official: boolean,
 *     author_role: string,
 *     attachments: Array<{ name: string, url: string }>,
 *     created_date: string,
 *     author_email: string (anonymized or team name)
 *   }>
 * }
 * 
 * Notes:
 * - Returns ALL public comments (contributor + staff replies)
 * - Filters out internal staff notes (is_internal_note = true)
 * - Anonymizes user emails for privacy
 * - Staff replies show workspace name as author
 */
Deno.serve(async (req) => {
  try {
    // Apply rate limiting (60 req/min per IP)
    const rateLimitResponse = applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;
    
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { feedback_id, workspace_id } = payload;

    if (!feedback_id || !workspace_id) {
      return Response.json({ error: 'feedback_id and workspace_id are required' }, { status: 400 });
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

    // Fetch feedback item
    const feedbackItems = await base44.asServiceRole.entities.Feedback.filter({ 
      id: feedback_id,
      workspace_id,
      visibility: 'public'
    });

    if (feedbackItems.length === 0) {
      return Response.json({ error: 'Feedback not found or not public' }, { status: 404 });
    }

    const feedback = feedbackItems[0];

    // Fetch responses (exclude internal notes)
    const allResponses = await base44.asServiceRole.entities.FeedbackResponse.filter({
      feedback_id,
      workspace_id
    }, 'created_date');

    // Filter out internal staff notes
    const publicResponses = allResponses.filter(r => !r.is_internal_note);

    // Return whitelisted fields
    const response = Response.json({
      id: feedback.id,
      workspace_id: feedback.workspace_id,
      title: feedback.title,
      type: feedback.type,
      description: feedback.description,
      steps_to_reproduce: feedback.steps_to_reproduce || '',
      expected_behavior: feedback.expected_behavior || '',
      actual_behavior: feedback.actual_behavior || '',
      environment: feedback.environment || null,
      attachments: feedback.attachments || [],
      status: feedback.status,
      tags: feedback.tags || [],
      vote_count: feedback.vote_count || 0,
      created_date: feedback.created_date,
      author_display_name: 'Community Member',
      response_count: publicResponses.length,
      responses: publicResponses.map(r => ({
        id: r.id,
        content: r.content,
        is_official: r.is_official || false,
        author_role: r.author_role || 'user',
        attachments: r.attachments || [],
        created_date: r.created_date,
        author_label: r.is_official 
          ? `${workspaces[0].name} Team` 
          : 'Community Member'
      }))
    });
    
    // Cache for 3 minutes (details change with new comments)
    return addCacheHeaders(response, 180);

  } catch (error) {
    console.error('Public feedback detail fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});