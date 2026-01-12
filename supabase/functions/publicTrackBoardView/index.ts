import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addNoCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    const payload = await req.json();
    const { slug, referrer, session_id } = payload;

    if (!slug) {
      return new Response(JSON.stringify({ error: "slug is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.ANALYTICS, {
      sessionId: session_id,
      identifier: slug,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const { data: board, error: boardError } = await supabaseAdmin
      .from("boards")
      .select("id")
      .eq("slug", slug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (boardError) {
      console.error("Board lookup error:", boardError);
      return new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!board) {
      return new Response(JSON.stringify({ error: "Board not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = new Response(
      JSON.stringify({
        success: true,
        board_id: board.id,
        referrer: referrer || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );

    return addNoCacheHeaders(response);
  } catch (error) {
    console.error("Public board view tracking error:", error);
    return new Response(JSON.stringify({ success: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
