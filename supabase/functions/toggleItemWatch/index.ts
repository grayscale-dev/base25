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
    const itemId = String(payload?.item_id || "").trim();

    if (!workspaceId || !itemId) {
      return json({ error: "workspace_id and item_id are required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "contributor");
    if (!auth.success) return auth.error;

    const { data: item, error: itemError } = await supabaseAdmin
      .from("items")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", itemId)
      .limit(1)
      .maybeSingle();

    if (itemError) {
      console.error("toggleItemWatch item lookup error:", itemError);
      return json({ error: "Failed to validate item" }, 500);
    }
    if (!item) {
      return json({ error: "Item not found" }, 404);
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("item_watchers")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("item_id", itemId)
      .eq("user_id", auth.user.id)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("toggleItemWatch existing lookup error:", existingError);
      return json({ error: "Failed to update watch state" }, 500);
    }

    let watched = false;
    if (existing?.id) {
      const { error: deleteError } = await supabaseAdmin
        .from("item_watchers")
        .delete()
        .eq("id", existing.id);
      if (deleteError) {
        console.error("toggleItemWatch delete error:", deleteError);
        return json({ error: "Failed to update watch state" }, 500);
      }
      watched = false;
    } else {
      const { error: insertError } = await supabaseAdmin.from("item_watchers").insert({
        workspace_id: workspaceId,
        item_id: itemId,
        user_id: auth.user.id,
      });
      if (insertError) {
        console.error("toggleItemWatch insert error:", insertError);
        return json({ error: "Failed to update watch state" }, 500);
      }
      watched = true;
    }

    const { count, error: countError } = await supabaseAdmin
      .from("item_watchers")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("item_id", itemId);

    if (countError) {
      console.error("toggleItemWatch count error:", countError);
      return json({ error: "Failed to update watch state" }, 500);
    }

    return json({ watched, watcher_count: count || 0 });
  } catch (error) {
    console.error("toggleItemWatch error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
