import { authorizeWriteAction } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WRITE_ACTION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const workspaceId = String(payload?.workspace_id || "").trim();

    if (!workspaceId) {
      return json({ error: "workspace_id is required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "contributor");
    if (!auth.success) return auth.error;

    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("user_alerts")
      .update({ is_read: true, read_at: nowIso })
      .eq("workspace_id", workspaceId)
      .eq("user_id", auth.user.id)
      .eq("is_read", false)
      .select("id");

    if (error) {
      console.error("markAlertsRead update error:", error);
      return json({ error: "Failed to mark alerts as read" }, 500);
    }

    return json({ updated: (data || []).length });
  } catch (error) {
    console.error("markAlertsRead error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
