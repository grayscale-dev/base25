import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

Deno.serve(async (req) => {
  try {
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;

    const payload = await req.json();
    const { board_id, parent_id } = payload;

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
      .from("doc_pages")
      .select("*")
      .eq("board_id", board_id)
      .eq("is_published", true)
      .order("order", { ascending: true });

    if (parent_id !== undefined) {
      query = query.eq("parent_id", parent_id || null);
    }

    const { data: pages, error } = await query;
    if (error) {
      console.error("Doc pages fetch error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const publicPages = (pages ?? []).map((page) => ({
      id: page.id,
      board_id: page.board_id,
      parent_id: page.parent_id || null,
      title: page.title,
      slug: page.slug,
      type: page.type || "page",
      order: page.order || 0,
    }));

    const response = Response.json({ pages: publicPages });
    return addCacheHeaders(response, 300);
  } catch (error) {
    console.error("Public docs fetch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
