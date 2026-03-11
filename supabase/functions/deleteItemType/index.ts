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
    const itemTypeId = payload?.item_type_id;
    const replacementItemTypeId = payload?.replacement_item_type_id || null;

    if (!workspaceId || !itemTypeId) {
      return json({ error: "workspace_id and item_type_id are required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "admin");
    if (!auth.success) return auth.error;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("item_types")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", itemTypeId)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("deleteItemType lookup error:", existingError);
      return json({ error: "Failed to load item type" }, 500);
    }
    if (!existing) {
      return json({ error: "Item type not found" }, 404);
    }

    const { count: activeCount } = await supabaseAdmin
      .from("item_types")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    if ((activeCount || 0) <= 1) {
      return json({ error: "Each workspace must keep at least one active item type" }, 400);
    }

    const { count: inUseCount } = await supabaseAdmin
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("item_type_id", itemTypeId);

    if ((inUseCount || 0) > 0) {
      if (!replacementItemTypeId) {
        return json({ error: "replacement_item_type_id is required when type is assigned to items" }, 409);
      }
      if (replacementItemTypeId === itemTypeId) {
        return json({ error: "replacement_item_type_id must be different" }, 400);
      }

      const { data: replacementType, error: replacementError } = await supabaseAdmin
        .from("item_types")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("id", replacementItemTypeId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (replacementError) {
        console.error("deleteItemType replacement lookup error:", replacementError);
        return json({ error: "Failed to validate replacement item type" }, 500);
      }
      if (!replacementType) {
        return json({ error: "replacement_item_type_id is invalid" }, 400);
      }

      const { error: reassignmentError } = await supabaseAdmin
        .from("items")
        .update({ item_type_id: replacementItemTypeId })
        .eq("workspace_id", workspaceId)
        .eq("item_type_id", itemTypeId);

      if (reassignmentError) {
        console.error("deleteItemType reassignment error:", reassignmentError);
        return json({ error: "Failed to reassign items to replacement type" }, 500);
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("item_types")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", itemTypeId);

    if (deleteError) {
      console.error("deleteItemType delete error:", deleteError);
      return json({ error: "Failed to delete item type" }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("deleteItemType error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
