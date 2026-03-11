import { authorizeWriteAction, isAdminLikeRole } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { validateMetadata } from "../_shared/itemValidation.ts";
import { createWatcherAlerts } from "../_shared/alerts.ts";

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

function normalizePriority(metadata: unknown) {
  const value = (metadata && typeof metadata === "object" && !Array.isArray(metadata))
    ? (metadata as Record<string, unknown>).priority
    : undefined;
  if (typeof value !== "string" || !value.trim()) {
    return "not_set";
  }
  return value.trim().toLowerCase();
}

function normalizeMetadata(payloadMetadata: unknown, fallback: unknown) {
  if (payloadMetadata && typeof payloadMetadata === "object" && !Array.isArray(payloadMetadata)) {
    return payloadMetadata;
  }
  return fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WRITE_ACTION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const workspaceId = payload?.workspace_id;
    const itemId = payload?.item_id;
    const statusId = payload?.status_id;
    const itemTypeId = payload?.item_type_id;
    const title = payload?.title;
    const description = payload?.description;
    const metadata = payload?.metadata;
    const tags = payload?.tags;
    const visibility = payload?.visibility;
    const assignedTo = Object.prototype.hasOwnProperty.call(payload || {}, "assigned_to")
      ? payload?.assigned_to ?? null
      : undefined;

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

    if (auth.role === "contributor") {
      if (existing.group_key !== "feedback") {
        return json({ error: "Contributors can only edit feedback items" }, 403);
      }
      if (!existing.submitter_id || existing.submitter_id !== auth.user.id) {
        return json({ error: "Contributors can only edit their own feedback items" }, 403);
      }
    }

    const nextStatusId = statusId ?? existing.status_id;

    const { data: nextStatusRow, error: nextStatusError } = await supabaseAdmin
      .from("item_statuses")
      .select("id, group_key, status_key, label, is_active")
      .eq("workspace_id", workspaceId)
      .eq("id", nextStatusId)
      .limit(1)
      .maybeSingle();

    if (nextStatusError) {
      console.error("updateItem status lookup error:", nextStatusError);
      return json({ error: "Failed to validate status" }, 500);
    }
    if (!nextStatusRow || nextStatusRow.is_active === false) {
      return json({ error: "status_id is not valid for this workspace" }, 400);
    }

    const nextGroup = nextStatusRow.group_key;

    if (nextGroup !== existing.group_key && !isAdminLikeRole(auth.role)) {
      return json({ error: "Only admins can move items across groups" }, 403);
    }

    if (auth.role === "contributor" && nextGroup !== "feedback") {
      return json({ error: "Contributors can only edit feedback items" }, 403);
    }

    if (auth.role === "contributor" && nextStatusId !== existing.status_id) {
      return json({ error: "Contributors cannot change item status" }, 403);
    }

    if (auth.role === "contributor" && itemTypeId && itemTypeId !== existing.item_type_id) {
      return json({ error: "Contributors cannot change item type" }, 403);
    }

    if (auth.role === "contributor" && typeof title === "string" && title.trim() !== String(existing.title || "").trim()) {
      return json({ error: "Contributors cannot change item title" }, 403);
    }

    if (auth.role === "contributor" && Object.prototype.hasOwnProperty.call(payload || {}, "metadata")) {
      const normalizedIncoming = JSON.stringify(normalizeMetadata(metadata, existing.metadata) || {});
      const normalizedExisting = JSON.stringify(existing.metadata || {});
      if (normalizedIncoming !== normalizedExisting) {
        return json({ error: "Contributors cannot change item metadata" }, 403);
      }
    }

    if (assignedTo !== undefined && !isAdminLikeRole(auth.role)) {
      return json({ error: "Only admin or owner can change assignee" }, 403);
    }

    const nextMetadata = metadata ?? existing.metadata;
    const metadataCheck = validateMetadata(nextGroup, nextMetadata);
    if (!metadataCheck.valid) {
      return json({ error: metadataCheck.message }, 400);
    }

    let nextItemTypeId = itemTypeId ?? existing.item_type_id ?? null;
    if (!nextItemTypeId) {
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
        console.error("updateItem fallback type lookup error:", fallbackTypeError);
        return json({ error: "Failed to resolve item type" }, 500);
      }
      if (!fallbackType?.id) {
        return json({ error: "No active item types are configured for this workspace" }, 409);
      }
      nextItemTypeId = fallbackType.id;
    } else {
      const { data: typeRow, error: typeError } = await supabaseAdmin
        .from("item_types")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("id", nextItemTypeId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (typeError) {
        console.error("updateItem type lookup error:", typeError);
        return json({ error: "Failed to validate item type" }, 500);
      }
      if (!typeRow) {
        return json({ error: "item_type_id is not valid for this workspace" }, 400);
      }
    }

    const patch: Record<string, unknown> = {
      status_id: nextStatusRow.id,
      group_key: nextGroup,
      status_key: nextStatusRow.status_key,
      metadata: nextMetadata,
      item_type_id: nextItemTypeId,
    };

    if (typeof title === "string") patch.title = title.trim();
    if (typeof description === "string") patch.description = description;
    if (Array.isArray(tags)) patch.tags = tags;
    if (typeof visibility === "string") patch.visibility = visibility;
    if (assignedTo !== undefined) patch.assigned_to = assignedTo;

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

    const itemTitle = String(updated.title || existing.title || "Item");

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
        author_role: isAdminLikeRole(auth.role) ? "admin" : "user",
      });
    }

    if (existing.status_id !== updated.status_id) {
      const { data: oldStatusRow } = await supabaseAdmin
        .from("item_statuses")
        .select("label")
        .eq("workspace_id", workspaceId)
        .eq("id", existing.status_id)
        .limit(1)
        .maybeSingle();

      const fromStatusLabel = oldStatusRow?.label || existing.status_key || "Unknown";
      const toStatusLabel = nextStatusRow.label || updated.status_key || "Unknown";
      const { data: statusActivity } = await supabaseAdmin.from("item_activities").insert({
        workspace_id: workspaceId,
        item_id: updated.id,
        activity_type: "status_change",
        content: `Status changed from ${fromStatusLabel} to ${toStatusLabel}`,
        metadata: {
          from_status_id: existing.status_id,
          to_status_id: updated.status_id,
        },
        author_id: auth.user.id,
        author_role: isAdminLikeRole(auth.role) ? "admin" : "user",
      }).select("id").single();

      await createWatcherAlerts({
        workspaceId,
        itemId: updated.id,
        itemActivityId: statusActivity?.id || null,
        alertType: "status_change",
        actorUserId: auth.user.id,
        title: "Status changed on watched item",
        body: `${itemTitle}: ${fromStatusLabel} -> ${toStatusLabel}`,
        metadata: {
          from_status_id: existing.status_id,
          to_status_id: updated.status_id,
        },
      });
    }

    if (existing.item_type_id !== updated.item_type_id) {
      const { data: typeRows } = await supabaseAdmin
        .from("item_types")
        .select("id, label")
        .eq("workspace_id", workspaceId)
        .in("id", [existing.item_type_id, updated.item_type_id].filter(Boolean));

      const typeLabelById = new Map<string, string>();
      (typeRows || []).forEach((row) => {
        typeLabelById.set(String(row.id), String(row.label || "Unknown"));
      });

      const fromTypeLabel = typeLabelById.get(String(existing.item_type_id)) || "Unknown";
      const toTypeLabel = typeLabelById.get(String(updated.item_type_id)) || "Unknown";
      const { data: typeActivity } = await supabaseAdmin.from("item_activities").insert({
        workspace_id: workspaceId,
        item_id: updated.id,
        activity_type: "type_change",
        content: `Type changed from ${fromTypeLabel} to ${toTypeLabel}`,
        metadata: {
          from_item_type_id: existing.item_type_id,
          to_item_type_id: updated.item_type_id,
        },
        author_id: auth.user.id,
        author_role: isAdminLikeRole(auth.role) ? "admin" : "user",
      }).select("id").single();

      await createWatcherAlerts({
        workspaceId,
        itemId: updated.id,
        itemActivityId: typeActivity?.id || null,
        alertType: "type_change",
        actorUserId: auth.user.id,
        title: "Type changed on watched item",
        body: `${itemTitle}: ${fromTypeLabel} -> ${toTypeLabel}`,
        metadata: {
          from_item_type_id: existing.item_type_id,
          to_item_type_id: updated.item_type_id,
        },
      });
    }

    const fromPriority = normalizePriority(existing.metadata);
    const toPriority = normalizePriority(updated.metadata);
    if (fromPriority !== toPriority) {
      const { data: priorityActivity } = await supabaseAdmin.from("item_activities").insert({
        workspace_id: workspaceId,
        item_id: updated.id,
        activity_type: "priority_change",
        content: `Priority changed from ${fromPriority} to ${toPriority}`,
        metadata: {
          from_priority: fromPriority,
          to_priority: toPriority,
        },
        author_id: auth.user.id,
        author_role: isAdminLikeRole(auth.role) ? "admin" : "user",
      }).select("id").single();

      await createWatcherAlerts({
        workspaceId,
        itemId: updated.id,
        itemActivityId: priorityActivity?.id || null,
        alertType: "priority_change",
        actorUserId: auth.user.id,
        title: "Priority changed on watched item",
        body: `${itemTitle}: ${fromPriority} -> ${toPriority}`,
        metadata: {
          from_priority: fromPriority,
          to_priority: toPriority,
        },
      });
    }

    if (existing.assigned_to !== updated.assigned_to) {
      const fromAssignee = existing.assigned_to ? String(existing.assigned_to) : "unassigned";
      const toAssignee = updated.assigned_to ? String(updated.assigned_to) : "unassigned";
      const { data: assigneeActivity } = await supabaseAdmin.from("item_activities").insert({
        workspace_id: workspaceId,
        item_id: updated.id,
        activity_type: "assignee_change",
        content: `Assignee changed from ${fromAssignee} to ${toAssignee}`,
        metadata: {
          from_assignee_id: existing.assigned_to,
          to_assignee_id: updated.assigned_to,
        },
        author_id: auth.user.id,
        author_role: isAdminLikeRole(auth.role) ? "admin" : "user",
      }).select("id").single();

      await createWatcherAlerts({
        workspaceId,
        itemId: updated.id,
        itemActivityId: assigneeActivity?.id || null,
        alertType: "assignee_change",
        actorUserId: auth.user.id,
        title: "Assignee changed on watched item",
        body: `${itemTitle}: ${fromAssignee} -> ${toAssignee}`,
        metadata: {
          from_assignee_id: existing.assigned_to,
          to_assignee_id: updated.assigned_to,
        },
      });
    }

    return json(updated);
  } catch (error) {
    console.error("updateItem error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
