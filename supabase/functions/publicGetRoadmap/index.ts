import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

Deno.serve(async (req) => {
  try {
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;

    const payload = await req.json();
    const { board_id, status } = payload;

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
      .from("roadmap_items")
      .select("*")
      .eq("board_id", board_id)
      .eq("visibility", "public")
      .order("display_order", { ascending: true });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: items, error } = await query;
    if (error) {
      console.error("Roadmap fetch error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const publicItems = (items ?? []).map((item) => ({
      id: item.id,
      board_id: item.board_id,
      title: item.title,
      description: item.description || "",
      status: item.status,
      target_date: item.target_date || null,
      target_quarter: item.target_quarter || null,
      tags: item.tags || [],
      display_order: item.display_order || 0,
    }));

    const response = Response.json({ items: publicItems });
    return addCacheHeaders(response, 180);
  } catch (error) {
    console.error("Public roadmap fetch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
