import { requireWorkspaceReadAccess } from "../_shared/itemAccess.ts";
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

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const access = await requireWorkspaceReadAccess(req, payload);
    if (!access.success) {
      return json({ error: access.error }, access.status || 403);
    }

    if (!access.user?.id) {
      return json({ error: "Authentication required" }, 401);
    }

    const { count, error } = await supabaseAdmin
      .from("user_alerts")
      .select("id", { head: true, count: "exact" })
      .eq("workspace_id", access.workspace.id)
      .eq("user_id", access.user.id)
      .eq("is_read", false);

    if (error) {
      console.error("getUnreadAlertCount query error:", error);
      return json({ error: "Failed to load unread count" }, 500);
    }

    return json({ unread_count: count || 0 });
  } catch (error) {
    console.error("getUnreadAlertCount error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
