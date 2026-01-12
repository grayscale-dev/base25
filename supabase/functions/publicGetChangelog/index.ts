import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

Deno.serve(async (req) => {
  try {
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;

    const payload = await req.json();
    const { board_id, limit = 50, offset = 0 } = payload;

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

    const { data: entries, error, count } = await supabaseAdmin
      .from("changelog_entries")
      .select("*", { count: "exact" })
      .eq("board_id", board_id)
      .eq("visibility", "public")
      .order("release_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Changelog fetch error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const publicEntries = (entries ?? []).map((entry) => ({
      id: entry.id,
      board_id: entry.board_id,
      title: entry.title,
      description: entry.description || "",
      release_date: entry.release_date,
      tags: entry.tags || [],
    }));

    const response = Response.json({
      items: publicEntries,
      total: count ?? publicEntries.length,
    });

    return addCacheHeaders(response, 300);
  } catch (error) {
    console.error("Public changelog fetch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
