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
    const itemTypeId = payload?.item_type_id || null;
    const label = String(payload?.label || "").trim();
    const isActive = payload?.is_active ?? true;
    const displayOrder = Number(payload?.display_order ?? 0);

    if (!workspaceId || !label) {
      return json({ error: "workspace_id and label are required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "admin");
    if (!auth.success) return auth.error;

    const mutation = itemTypeId
      ? supabaseAdmin
          .from("item_types")
          .update({
            label,
            is_active: Boolean(isActive),
            display_order: Number.isNaN(displayOrder) ? 0 : displayOrder,
          })
          .eq("workspace_id", workspaceId)
          .eq("id", itemTypeId)
      : supabaseAdmin.from("item_types").insert({
          workspace_id: workspaceId,
          label,
          is_active: Boolean(isActive),
          display_order: Number.isNaN(displayOrder) ? 0 : displayOrder,
        });

    const { data, error } = await mutation.select("*").single();
    if (error) {
      const isDuplicate = error.code === "23505";
      return json(
        { error: isDuplicate ? "Item type label must be unique in workspace" : "Failed to save item type" },
        isDuplicate ? 409 : 500,
      );
    }

    return json(data);
  } catch (error) {
    console.error("upsertItemType error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
