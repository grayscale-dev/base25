import { authorizeWriteAction, isAdminLikeRole } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { validateMetadata } from "../_shared/itemValidation.ts";

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

function getContributorDefaultFeedbackMetadata() {
  return {
    type: "feature_request",
    priority: "medium",
    steps_to_reproduce: "",
    expected_behavior: "",
    actual_behavior: "",
    environment: "",
    attachments: [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WRITE_ACTION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const workspaceId = payload?.workspace_id;
    const statusId = payload?.status_id;
    const title = payload?.title;
    const description = payload?.description ?? "";
    const incomingMetadata = payload?.metadata ?? {};
    const tags = Array.isArray(payload?.tags) ? payload.tags : [];
    const visibility = payload?.visibility ?? "public";
    const requestedItemTypeId = payload?.item_type_id || null;
    const requestedAssigneeId = payload?.assigned_to || null;

    if (!workspaceId || !statusId || !title) {
      return json(
        { error: "Missing required fields", required: ["workspace_id", "status_id", "title"] },
        400,
      );
    }

    const auth = await authorizeWriteAction(req, workspaceId, "contributor");
    if (!auth.success) {
      return auth.error;
    }

    const { data: statusRow, error: statusError } = await supabaseAdmin
      .from("item_statuses")
      .select("id, group_key, status_key, label, is_active")
      .eq("workspace_id", workspaceId)
      .eq("id", statusId)
      .limit(1)
      .maybeSingle();

    if (statusError) {
      console.error("createItem status lookup error:", statusError);
      return json({ error: "Failed to validate status" }, 500);
    }
    if (!statusRow || statusRow.is_active === false) {
      return json({ error: "status_id is not valid for this workspace" }, 400);
    }

    if (auth.role === "contributor" && statusRow.group_key !== "feedback") {
      return json({ error: "Contributors can only create feedback items" }, 403);
    }

    if (auth.role === "contributor") {
      const { data: defaultFeedbackStatus, error: defaultStatusError } = await supabaseAdmin
        .from("item_statuses")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("group_key", "feedback")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (defaultStatusError) {
        console.error("createItem default status lookup error:", defaultStatusError);
        return json({ error: "Failed to resolve default feedback status" }, 500);
      }
      if (!defaultFeedbackStatus?.id) {
        return json({ error: "No default feedback status is configured for this workspace" }, 409);
      }
      if (statusRow.id !== defaultFeedbackStatus.id) {
        return json({ error: "Contributors cannot choose feedback status" }, 403);
      }
    }

    if (requestedAssigneeId && !isAdminLikeRole(auth.role)) {
      return json({ error: "Only admin or owner can assign items" }, 403);
    }

    let metadata = incomingMetadata;
    if (auth.role === "contributor") {
      metadata = getContributorDefaultFeedbackMetadata();
    }

    const metadataCheck = validateMetadata(statusRow.group_key, metadata);
    if (!metadataCheck.valid) {
      return json({ error: metadataCheck.message }, 400);
    }

    let itemTypeId: string | null = requestedItemTypeId;
    if (auth.role === "contributor") {
      itemTypeId = null;
    }

    if (itemTypeId) {
      const { data: typeRow, error: typeError } = await supabaseAdmin
        .from("item_types")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("id", itemTypeId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (typeError) {
        console.error("createItem type lookup error:", typeError);
        return json({ error: "Failed to validate item type" }, 500);
      }

      if (!typeRow) {
        return json({ error: "item_type_id is not valid for this workspace" }, 400);
      }
    } else {
      const { data: fallbackType, error: fallbackTypeError } = await supabaseAdmin
        .from("item_types")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fallbackTypeError) {
        console.error("createItem fallback type lookup error:", fallbackTypeError);
        return json({ error: "Failed to resolve default item type" }, 500);
      }

      if (!fallbackType?.id) {
        return json({ error: "No active item types are configured for this workspace" }, 409);
      }

      itemTypeId = fallbackType.id;
    }

    const { data: item, error: createError } = await supabaseAdmin
      .from("items")
      .insert({
        workspace_id: workspaceId,
        status_id: statusRow.id,
        group_key: statusRow.group_key,
        status_key: statusRow.status_key,
        title: String(title).trim(),
        description: String(description || ""),
        metadata,
        tags,
        visibility,
        item_type_id: itemTypeId,
        assigned_to: requestedAssigneeId || null,
        submitter_id: auth.user.id,
        submitter_email: auth.user.email,
      })
      .select("*")
      .single();

    if (createError) {
      console.error("createItem insert error:", createError);
      return json({ error: "Failed to create item" }, 500);
    }

    await supabaseAdmin.from("item_activities").insert({
      workspace_id: workspaceId,
      item_id: item.id,
      activity_type: "system",
      content: "Item created",
      metadata: {},
      author_id: auth.user.id,
      author_role: isAdminLikeRole(auth.role) ? "admin" : "user",
    });

    return json(item);
  } catch (error) {
    console.error("createItem error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
