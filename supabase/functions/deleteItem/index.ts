import { authorizeWriteAction } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const workspaceId = payload?.workspace_id;
    const itemId = payload?.item_id;

    if (!workspaceId || !itemId) {
      return json({ error: "workspace_id and item_id are required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "admin");
    if (!auth.success) {
      return auth.error;
    }

    const { error } = await supabaseAdmin
      .from("items")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", itemId);

    if (error) {
      console.error("deleteItem error:", error);
      return json({ error: "Failed to delete item" }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("deleteItem exception:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
