import { supabaseAdmin } from "./supabase.ts";

export const WATCH_ALERT_TYPES = [
  "comment",
  "status_change",
  "type_change",
  "priority_change",
  "assignee_change",
] as const;

export type WatchAlertType = (typeof WATCH_ALERT_TYPES)[number];

export function isWatchAlertType(value: string): value is WatchAlertType {
  return WATCH_ALERT_TYPES.includes(value as WatchAlertType);
}

export async function createWatcherAlerts(params: {
  workspaceId: string;
  itemId: string;
  itemActivityId: string | null;
  alertType: WatchAlertType;
  actorUserId: string | null;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  const { workspaceId, itemId, itemActivityId, alertType, actorUserId, title, body, metadata = {} } = params;

  const watchersQuery = supabaseAdmin
    .from("item_watchers")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("item_id", itemId);

  const { data: watcherRows, error: watcherError } = await watchersQuery;

  if (watcherError) {
    console.error("createWatcherAlerts watcher lookup error:", watcherError);
    return;
  }

  const watcherIds = (watcherRows || [])
    .map((row) => String(row.user_id || ""))
    .filter(Boolean)
    .filter((userId) => !actorUserId || userId !== actorUserId);

  if (watcherIds.length === 0) {
    return;
  }

  const rows = watcherIds.map((userId) => ({
    workspace_id: workspaceId,
    user_id: userId,
    item_id: itemId,
    item_activity_id: itemActivityId,
    alert_type: alertType,
    title,
    body,
    metadata,
    is_read: false,
    read_at: null,
  }));

  const { error: insertError } = await supabaseAdmin.from("user_alerts").insert(rows);
  if (insertError) {
    console.error("createWatcherAlerts insert error:", insertError);
  }
}
