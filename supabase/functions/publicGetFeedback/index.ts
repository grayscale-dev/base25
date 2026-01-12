import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

Deno.serve(async (req) => {
  try {
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;

    const payload = await req.json();
    const { board_id, type, status, limit = 50, offset = 0 } = payload;

    if (!board_id) {
      return Response.json({ error: "board_id is required" }, { status: 400 });
    }

    const { data: board, error: boardError } = await supabaseAdmin
      .from("boards")
      .select("id")
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

    let query = supabaseAdmin
      .from("feedback")
      .select("*", { count: "exact" })
      .eq("board_id", board_id)
      .eq("visibility", "public")
      .order("created_at", { ascending: false });

    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);

    const { data: items, error, count } = await query.range(
      offset,
      offset + limit - 1,
    );

    if (error) {
      console.error("Feedback fetch error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const { data: responses, error: responsesError } = await supabaseAdmin
      .from("feedback_responses")
      .select("feedback_id")
      .eq("board_id", board_id);

    if (responsesError) {
      console.error("Response count error:", responsesError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const responseCounts: Record<string, number> = {};
    (responses ?? []).forEach((response) => {
      const key = response.feedback_id;
      responseCounts[key] = (responseCounts[key] || 0) + 1;
    });

    const publicItems = (items ?? []).map((item) => ({
      id: item.id,
      board_id: item.board_id,
      title: item.title,
      type: item.type,
      description: item.description,
      status: item.status,
      tags: item.tags || [],
      vote_count: item.vote_count || 0,
      response_count: responseCounts[item.id] || 0,
      created_date: item.created_at,
      author_display_name: "Community Member",
    }));

    const response = Response.json({
      items: publicItems,
      total: count ?? publicItems.length,
    });

    return addCacheHeaders(response, 120);
  } catch (error) {
    console.error("Public feedback fetch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
