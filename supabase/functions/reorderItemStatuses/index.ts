import { authorizeWriteAction } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { isValidGroupKey, ITEM_GROUP_KEYS } from "../_shared/itemValidation.ts";

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

function clampIndex(index: number, listLength: number) {
  if (Number.isNaN(index) || index < 0) return 0;
  if (index > listLength) return listLength;
  return index;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WRITE_ACTION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const workspaceId = payload?.workspace_id;
    const statusId = payload?.status_id;
    const targetGroupKey = payload?.target_group_key;
    const targetIndex = Number(payload?.target_index ?? 0);
    const reassignmentStatusId = payload?.reassignment_status_id || null;

    if (!workspaceId || !statusId || !isValidGroupKey(targetGroupKey)) {
      return json({ error: "workspace_id, status_id, and target_group_key are required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "admin");
    if (!auth.success) return auth.error;

    const { data: sourceStatus, error: sourceStatusError } = await supabaseAdmin
      .from("item_statuses")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", statusId)
      .limit(1)
      .maybeSingle();

    if (sourceStatusError) {
      console.error("reorderItemStatuses source lookup error:", sourceStatusError);
      return json({ error: "Failed to load status" }, 500);
    }
    if (!sourceStatus) {
      return json({ error: "Status not found" }, 404);
    }

    const isCrossGroupMove = sourceStatus.group_key !== targetGroupKey;

    const { data: statusRows, error: statusRowsError } = await supabaseAdmin
      .from("item_statuses")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (statusRowsError) {
      console.error("reorderItemStatuses status list error:", statusRowsError);
      return json({ error: "Failed to load statuses" }, 500);
    }

    const sourceGroupStatuses = (statusRows || []).filter((row) => row.group_key === sourceStatus.group_key);
    if (isCrossGroupMove && sourceGroupStatuses.length <= 1) {
      return json({ error: "Each status group must keep at least one status" }, 400);
    }

    if (isCrossGroupMove) {
      const { count: assignedCount } = await supabaseAdmin
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status_id", sourceStatus.id);

      if ((assignedCount || 0) > 0) {
        if (!reassignmentStatusId) {
          return json({ error: "reassignment_status_id is required when moving an in-use status across groups" }, 409);
        }
        if (reassignmentStatusId === sourceStatus.id) {
          return json({ error: "reassignment_status_id must be different from moved status" }, 400);
        }

        const { data: reassignmentStatus, error: reassignmentError } = await supabaseAdmin
          .from("item_statuses")
          .select("id, group_key, is_active")
          .eq("workspace_id", workspaceId)
          .eq("id", reassignmentStatusId)
          .limit(1)
          .maybeSingle();

        if (reassignmentError) {
          console.error("reorderItemStatuses reassignment lookup error:", reassignmentError);
          return json({ error: "Failed to validate reassignment status" }, 500);
        }
        if (!reassignmentStatus || reassignmentStatus.is_active === false || !ITEM_GROUP_KEYS.includes(reassignmentStatus.group_key)) {
          return json({ error: "reassignment_status_id is invalid for this workspace" }, 400);
        }

        const { error: reassignmentUpdateError } = await supabaseAdmin
          .from("items")
          .update({ status_id: reassignmentStatus.id })
          .eq("workspace_id", workspaceId)
          .eq("status_id", sourceStatus.id);

        if (reassignmentUpdateError) {
          console.error("reorderItemStatuses item reassignment error:", reassignmentUpdateError);
          return json({ error: "Failed to reassign items from moved status" }, 500);
        }
      }
    }

    const statusMap = new Map<string, Record<string, unknown>>();
    (statusRows || []).forEach((row) => {
      statusMap.set(String(row.id), { ...row });
    });

    const sourceRecord = statusMap.get(String(sourceStatus.id));
    if (!sourceRecord) {
      return json({ error: "Status not found in workspace status set" }, 404);
    }
    sourceRecord.group_key = targetGroupKey;

    const grouped: Record<string, Record<string, unknown>[]> = {};
    ITEM_GROUP_KEYS.forEach((groupKey) => {
      grouped[groupKey] = [];
    });

    statusMap.forEach((status) => {
      const groupKey = String(status.group_key || "");
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(status);
    });

    for (const groupKey of Object.keys(grouped)) {
      grouped[groupKey] = grouped[groupKey]
        .filter((status) => String(status.id) !== String(sourceStatus.id))
        .sort((left, right) => Number(left.display_order || 0) - Number(right.display_order || 0));
    }

    const targetList = grouped[targetGroupKey] || [];
    const boundedTargetIndex = clampIndex(targetIndex, targetList.length);
    targetList.splice(boundedTargetIndex, 0, sourceRecord);
    grouped[targetGroupKey] = targetList;

    const updates: Promise<{ error: unknown }>[] = [];
    Object.entries(grouped).forEach(([groupKey, rows]) => {
      rows.forEach((row, index) => {
        const currentGroup = String(row.group_key || "");
        const currentOrder = Number(row.display_order || 0);
        if (currentGroup !== groupKey || currentOrder !== index) {
          updates.push(
            supabaseAdmin
              .from("item_statuses")
              .update({ group_key: groupKey, display_order: index })
              .eq("workspace_id", workspaceId)
              .eq("id", row.id),
          );
        }
      });
    });

    const updateResults = await Promise.all(updates);
    const updateFailure = updateResults.find((result) => result.error);
    if (updateFailure?.error) {
      console.error("reorderItemStatuses update error:", updateFailure.error);
      return json({ error: "Failed to reorder statuses" }, 500);
    }

    const { data: refreshedRows, error: refreshedError } = await supabaseAdmin
      .from("item_statuses")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("group_key", { ascending: true })
      .order("display_order", { ascending: true });

    if (refreshedError) {
      console.error("reorderItemStatuses refresh error:", refreshedError);
      return json({ error: "Failed to reload statuses" }, 500);
    }

    return json({ statuses: refreshedRows || [] });
  } catch (error) {
    console.error("reorderItemStatuses error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
