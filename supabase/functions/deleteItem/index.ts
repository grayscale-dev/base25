import { authorizeWriteAction, isAdminLikeRole } from "../_shared/authHelpers.ts";
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
    const itemId = payload?.item_id;

    if (!workspaceId || !itemId) {
      return json({ error: "workspace_id and item_id are required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "contributor");
    if (!auth.success) {
      return auth.error;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("items")
      .select("id, group_key, submitter_id")
      .eq("workspace_id", workspaceId)
      .eq("id", itemId)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("deleteItem lookup error:", existingError);
      return json({ error: "Failed to load item" }, 500);
    }
    if (!existing) {
      return json({ error: "Item not found" }, 404);
    }

    if (!isAdminLikeRole(auth.role)) {
      const canDeleteOwnFeedback =
        auth.role === "contributor" &&
        existing.group_key === "feedback" &&
        existing.submitter_id &&
        existing.submitter_id === auth.user.id;
      if (!canDeleteOwnFeedback) {
        return json({ error: "Contributors can only delete their own feedback items" }, 403);
      }
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
