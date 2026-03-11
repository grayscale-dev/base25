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
    const itemId = String(payload?.item_id || "").trim();
    if (!itemId) {
      return json({ error: "item_id is required" }, 400);
    }

    const access = await requireWorkspaceReadAccess(req, payload);
    if (!access.success) {
      return json({ error: access.error }, access.status || 403);
    }

    if (!access.user?.id) {
      return json({ error: "Authentication required" }, 401);
    }

    const workspaceId = access.workspace.id;

    const { data: item, error: itemError } = await supabaseAdmin
      .from("items")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", itemId)
      .limit(1)
      .maybeSingle();

    if (itemError) {
      console.error("getItemWatchState item lookup error:", itemError);
      return json({ error: "Failed to load watch state" }, 500);
    }
    if (!item) {
      return json({ error: "Item not found" }, 404);
    }

    const [{ count, error: countError }, { data: watchRow, error: watchError }] = await Promise.all([
      supabaseAdmin
        .from("item_watchers")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("item_id", itemId),
      supabaseAdmin
        .from("item_watchers")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("item_id", itemId)
        .eq("user_id", access.user.id)
        .limit(1)
        .maybeSingle(),
    ]);

    if (countError || watchError) {
      console.error("getItemWatchState lookup error:", countError || watchError);
      return json({ error: "Failed to load watch state" }, 500);
    }

    return json({
      watched: Boolean(watchRow?.id),
      watcher_count: count || 0,
    });
  } catch (error) {
    console.error("getItemWatchState error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
