import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

Deno.serve(async (req) => {
  try {
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;

    const payload = await req.json();
    const { item_id, board_id } = payload;

    if (!item_id || !board_id) {
      return Response.json(
        { error: "item_id and board_id are required" },
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

    const { data: item, error: itemError } = await supabaseAdmin
      .from("roadmap_items")
      .select("*")
      .eq("id", item_id)
      .eq("board_id", board_id)
      .eq("visibility", "public")
      .limit(1)
      .maybeSingle();

    if (itemError) {
      console.error("Roadmap item lookup error:", itemError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!item) {
      return Response.json(
        { error: "Roadmap item not found or not public" },
        { status: 404 },
      );
    }

    const { data: updates, error: updatesError } = await supabaseAdmin
      .from("roadmap_updates")
      .select("*")
      .eq("roadmap_item_id", item_id)
      .eq("board_id", board_id)
      .order("created_at", { ascending: false });

    if (updatesError) {
      console.error("Roadmap updates lookup error:", updatesError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const response = Response.json({
      id: item.id,
      board_id: item.board_id,
      title: item.title,
      description: item.description || "",
      status: item.status,
      target_date: item.target_date || null,
      target_quarter: item.target_quarter || null,
      tags: item.tags || [],
      display_order: item.display_order || 0,
      updates: (updates ?? []).map((update) => ({
        id: update.id,
        content: update.content,
        update_type: update.update_type,
        created_date: update.created_at,
        author_label: `${board.name} Team`,
      })),
    });

    return addCacheHeaders(response, 300);
  } catch (error) {
    console.error("Public roadmap detail fetch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
