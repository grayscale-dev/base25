import { authorizeWriteAction } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { isValidGroupKey } from "../_shared/itemValidation.ts";

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
    const groupKey = payload?.group_key;
    const displayName = String(payload?.display_name || "").trim();
    const displayOrder = Number(payload?.display_order ?? 0);

    if (!workspaceId || !isValidGroupKey(groupKey) || !displayName) {
      return json({ error: "workspace_id, group_key, and display_name are required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "admin");
    if (!auth.success) return auth.error;

    const { data: existing } = await supabaseAdmin
      .from("item_status_groups")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("group_key", groupKey)
      .limit(1)
      .maybeSingle();

    const mutation = existing
      ? supabaseAdmin
          .from("item_status_groups")
          .update({
            display_name: displayName,
            display_order: Number.isNaN(displayOrder) ? 0 : displayOrder,
          })
          .eq("id", existing.id)
      : supabaseAdmin.from("item_status_groups").insert({
          workspace_id: workspaceId,
          group_key: groupKey,
          display_name: displayName,
          display_order: Number.isNaN(displayOrder) ? 0 : displayOrder,
        });

    const { data, error } = await mutation.select("*").single();
    if (error) {
      console.error("upsertItemStatusGroup error:", error);
      return json({ error: "Failed to save status group" }, 500);
    }

    return json(data);
  } catch (error) {
    console.error("upsertItemStatusGroup exception:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
