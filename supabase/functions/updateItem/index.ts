import { authorizeWriteAction } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { isValidGroupKey, validateMetadata } from "../_shared/itemValidation.ts";

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
    const groupKey = payload?.group_key;
    const statusKey = payload?.status_key;
    const title = payload?.title;
    const description = payload?.description;
    const metadata = payload?.metadata;
    const tags = payload?.tags;
    const visibility = payload?.visibility;

    if (!workspaceId || !itemId) {
      return json({ error: "workspace_id and item_id are required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "contributor");
    if (!auth.success) {
      return auth.error;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("items")
      .select("*")
      .eq("id", itemId)
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("updateItem existing lookup error:", existingError);
      return json({ error: "Failed to load item" }, 500);
    }
    if (!existing) {
      return json({ error: "Item not found" }, 404);
    }

    const nextGroup = groupKey ?? existing.group_key;
    const nextStatus = statusKey ?? existing.status_key;
    if (!isValidGroupKey(nextGroup)) {
      return json({ error: "group_key is invalid" }, 400);
    }

    if (nextGroup !== existing.group_key && auth.role !== "admin") {
      return json({ error: "Only admins can move items across groups" }, 403);
    }

    const nextMetadata = metadata ?? existing.metadata;
    const metadataCheck = validateMetadata(nextGroup, nextMetadata);
    if (!metadataCheck.valid) {
      return json({ error: metadataCheck.message }, 400);
    }

    const { data: statusRow, error: statusError } = await supabaseAdmin
      .from("item_statuses")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("group_key", nextGroup)
      .eq("status_key", nextStatus)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (statusError) {
      console.error("updateItem status lookup error:", statusError);
      return json({ error: "Failed to validate status" }, 500);
    }
    if (!statusRow) {
      return json({ error: "status_key is not valid for this group" }, 400);
    }

    const patch: Record<string, unknown> = {
      group_key: nextGroup,
      status_key: nextStatus,
      metadata: nextMetadata,
    };

    if (typeof title === "string") patch.title = title.trim();
    if (typeof description === "string") patch.description = description;
    if (Array.isArray(tags)) patch.tags = tags;
    if (typeof visibility === "string") patch.visibility = visibility;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("items")
      .update(patch)
      .eq("id", itemId)
      .eq("workspace_id", workspaceId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error("updateItem update error:", updateError);
      return json({ error: "Failed to update item" }, 500);
    }
    if (!updated) {
      return json({ error: "Item not found" }, 404);
    }

    if (existing.group_key !== updated.group_key) {
      await supabaseAdmin.from("item_activities").insert({
        workspace_id: workspaceId,
        item_id: updated.id,
        activity_type: "group_change",
        content: `Moved from ${existing.group_key} to ${updated.group_key}`,
        metadata: {
          from_group: existing.group_key,
          to_group: updated.group_key,
        },
        author_id: auth.user.id,
        author_role: auth.role === "admin" ? "admin" : "user",
      });
    }

    if (existing.status_key !== updated.status_key) {
      await supabaseAdmin.from("item_activities").insert({
        workspace_id: workspaceId,
        item_id: updated.id,
        activity_type: "status_change",
        content: `Status changed from ${existing.status_key} to ${updated.status_key}`,
        metadata: {
          from_status: existing.status_key,
          to_status: updated.status_key,
        },
        author_id: auth.user.id,
        author_role: auth.role === "admin" ? "admin" : "user",
      });
    }

    return json(updated);
  } catch (error) {
    console.error("updateItem error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
