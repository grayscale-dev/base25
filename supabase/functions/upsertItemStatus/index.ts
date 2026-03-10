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

function normalizeStatusKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WRITE_ACTION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const workspaceId = payload?.workspace_id;
    const groupKey = payload?.group_key;
    const statusId = payload?.status_id;
    const label = String(payload?.label || "").trim();
    const statusKey = normalizeStatusKey(payload?.status_key);
    const displayOrder = Number(payload?.display_order ?? 0);
    const isActive = payload?.is_active ?? true;

    if (!workspaceId || !isValidGroupKey(groupKey) || !label || !statusKey) {
      return json(
        { error: "workspace_id, group_key, label, and status_key are required" },
        400,
      );
    }

    const auth = await authorizeWriteAction(req, workspaceId, "admin");
    if (!auth.success) return auth.error;

    const { data: duplicate } = await supabaseAdmin
      .from("item_statuses")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("group_key", groupKey)
      .eq("status_key", statusKey)
      .neq("id", statusId || "")
      .limit(1)
      .maybeSingle();

    if (duplicate) {
      return json({ error: "status_key must be unique within the group" }, 409);
    }

    const mutation = statusId
      ? supabaseAdmin
          .from("item_statuses")
          .update({
            label,
            status_key: statusKey,
            display_order: Number.isNaN(displayOrder) ? 0 : displayOrder,
            is_active: Boolean(isActive),
          })
          .eq("id", statusId)
      : supabaseAdmin.from("item_statuses").insert({
          workspace_id: workspaceId,
          group_key: groupKey,
          label,
          status_key: statusKey,
          display_order: Number.isNaN(displayOrder) ? 0 : displayOrder,
          is_active: Boolean(isActive),
        });

    const { data, error } = await mutation.select("*").single();
    if (error) {
      console.error("upsertItemStatus error:", error);
      return json({ error: "Failed to save status" }, 500);
    }

    return json(data);
  } catch (error) {
    console.error("upsertItemStatus exception:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
