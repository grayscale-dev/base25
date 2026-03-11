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
    const workspaceId = payload?.workspace_id;
    const statusId = payload?.status_id;
    if (!workspaceId || !statusId) {
      return json({ error: "workspace_id and status_id are required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "admin");
    if (!auth.success) return auth.error;

    const { data: statusRow, error: statusError } = await supabaseAdmin
      .from("item_statuses")
      .select("*")
      .eq("id", statusId)
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();

    if (statusError) {
      console.error("deleteItemStatus status lookup error:", statusError);
      return json({ error: "Failed to load status" }, 500);
    }
    if (!statusRow) {
      return json({ error: "Status not found" }, 404);
    }

    const { count: groupCount } = await supabaseAdmin
      .from("item_statuses")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("group_key", statusRow.group_key);

    if ((groupCount || 0) <= 1) {
      return json({ error: "Each status group must keep at least one status" }, 400);
    }

    const { count: itemCount } = await supabaseAdmin
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("group_key", statusRow.group_key)
      .eq("status_key", statusRow.status_key);

    if ((itemCount || 0) > 0) {
      return json({ error: "Cannot delete a status that is currently assigned to items" }, 409);
    }

    const { error } = await supabaseAdmin
      .from("item_statuses")
      .delete()
      .eq("id", statusId)
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("deleteItemStatus delete error:", error);
      return json({ error: "Failed to delete status" }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("deleteItemStatus exception:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
