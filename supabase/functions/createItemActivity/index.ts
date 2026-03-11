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

const ACTIVITY_TYPES = ["comment", "update", "status_change", "group_change", "system"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WRITE_ACTION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const workspaceId = payload?.workspace_id;
    const itemId = payload?.item_id;
    const activityType = payload?.activity_type || "comment";
    const content = payload?.content;
    const metadata = payload?.metadata ?? {};
    const isInternalNote = Boolean(payload?.is_internal_note);

    if (!workspaceId || !itemId || !content) {
      return json({ error: "workspace_id, item_id, and content are required" }, 400);
    }
    if (!ACTIVITY_TYPES.includes(activityType)) {
      return json({ error: "activity_type is invalid" }, 400);
    }
    if (isInternalNote && activityType !== "comment") {
      return json({ error: "Internal notes are supported only for comments" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "contributor");
    if (!auth.success) {
      return auth.error;
    }

    if (isInternalNote && !isAdminLikeRole(auth.role)) {
      return json({ error: "Only admins can add internal notes" }, 403);
    }

    if (auth.role === "contributor" && activityType !== "comment") {
      return json({ error: "Contributors can only post comments" }, 403);
    }

    const { data: item, error: itemError } = await supabaseAdmin
      .from("items")
      .select("id")
      .eq("id", itemId)
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();

    if (itemError) {
      console.error("createItemActivity item lookup error:", itemError);
      return json({ error: "Failed to validate item" }, 500);
    }
    if (!item) {
      return json({ error: "Item not found" }, 404);
    }

    const { data, error } = await supabaseAdmin
      .from("item_activities")
      .insert({
        workspace_id: workspaceId,
        item_id: itemId,
        activity_type: activityType,
        content: String(content).trim(),
        metadata,
        author_id: auth.user.id,
        author_role: isAdminLikeRole(auth.role) ? "admin" : "user",
        is_internal_note: isInternalNote,
      })
      .select("*")
      .single();

    if (error) {
      console.error("createItemActivity insert error:", error);
      return json({ error: "Failed to create activity" }, 500);
    }

    return json(data);
  } catch (error) {
    console.error("createItemActivity error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
