import { requireAuth } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addNoCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
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

    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return new Response(authCheck.error.body, {
        status: authCheck.error.status,
        headers: corsHeaders,
      });
    }

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("slug", slug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (workspaceError) {
      console.error("Workspace lookup error:", workspaceError);
      return new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!workspace) {
      return new Response(JSON.stringify({ error: "Workspace not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = new Response(
      JSON.stringify({
        success: true,
        workspace_id: workspace.id,
        referrer: referrer || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );

    return addNoCacheHeaders(response);
  } catch (error) {
    console.error("Public workspace view tracking error:", error);
    return new Response(JSON.stringify({ success: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
