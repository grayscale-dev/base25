import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

Deno.serve(async (req) => {
  try {
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;

    const payload = await req.json();
    const { slug, board_id } = payload;

    if (!slug || !board_id) {
      return Response.json(
        { error: "slug and board_id are required" },
        { status: 400 },
      );
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

    const { data: page, error: pageError } = await supabaseAdmin
      .from("doc_pages")
      .select("*")
      .eq("slug", slug)
      .eq("board_id", board_id)
      .eq("is_published", true)
      .limit(1)
      .maybeSingle();

    if (pageError) {
      console.error("Doc page lookup error:", pageError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!page) {
      return Response.json(
        { error: "Doc page not found or not published" },
        { status: 404 },
      );
    }

    const response = Response.json({
      id: page.id,
      board_id: page.board_id,
      parent_id: page.parent_id || null,
      title: page.title,
      slug: page.slug,
      content: page.content || "",
      content_type: page.content_type || "markdown",
      type: page.type || "page",
      order: page.order || 0,
    });

    return addCacheHeaders(response, 300);
  } catch (error) {
    console.error("Public doc detail fetch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
