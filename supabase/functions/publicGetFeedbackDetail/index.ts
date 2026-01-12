import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

Deno.serve(async (req) => {
  try {
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;

    const payload = await req.json();
    const { feedback_id, board_id } = payload;

    if (!feedback_id || !board_id) {
      return Response.json(
        { error: "feedback_id and board_id are required" },
        { status: 400 },
      );
    }

    const { data: board, error: boardError } = await supabaseAdmin
      .from("boards")
      .select("id, name")
      .eq("id", board_id)
      .eq("visibility", "public")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (boardError) {
      console.error("Board lookup error:", boardError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!board) {
      return Response.json(
        { error: "Board not found or not public" },
        { status: 404 },
      );
    }

    const { data: feedback, error: feedbackError } = await supabaseAdmin
      .from("feedback")
      .select("*")
      .eq("id", feedback_id)
      .eq("board_id", board_id)
      .eq("visibility", "public")
      .limit(1)
      .maybeSingle();

    if (feedbackError) {
      console.error("Feedback lookup error:", feedbackError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!feedback) {
      return Response.json(
        { error: "Feedback not found or not public" },
        { status: 404 },
      );
    }

    const { data: responses, error: responseError } = await supabaseAdmin
      .from("feedback_responses")
      .select("*")
      .eq("feedback_id", feedback_id)
      .eq("board_id", board_id)
      .order("created_at", { ascending: true });

    if (responseError) {
      console.error("Feedback responses lookup error:", responseError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const publicResponses = (responses ?? []).filter(
      (response) => !response.is_internal_note,
    );

    const response = Response.json({
      id: feedback.id,
      board_id: feedback.board_id,
      title: feedback.title,
      type: feedback.type,
      description: feedback.description,
      steps_to_reproduce: feedback.steps_to_reproduce || "",
      expected_behavior: feedback.expected_behavior || "",
      actual_behavior: feedback.actual_behavior || "",
      environment: feedback.environment || null,
      attachments: feedback.attachments || [],
      status: feedback.status,
      tags: feedback.tags || [],
      vote_count: feedback.vote_count || 0,
      created_date: feedback.created_at,
      author_display_name: "Community Member",
      response_count: publicResponses.length,
      responses: publicResponses.map((response) => ({
        id: response.id,
        content: response.content,
        is_official: response.is_official || false,
        author_role: response.author_role || "user",
        attachments: response.attachments || [],
        created_date: response.created_at,
        author_label: response.is_official
          ? `${board.name} Team`
          : "Community Member",
      })),
    });

    return addCacheHeaders(response, 180);
  } catch (error) {
    console.error("Public feedback detail fetch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
