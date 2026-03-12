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
    const access = await requireWorkspaceReadAccess(req, payload);
    if (!access.success) {
      return json({ error: access.error }, access.status || 403);
    }

    if (!access.user?.id) {
      return json({ error: "Authentication required" }, 401);
    }

    const limit = Math.min(Math.max(Number(payload?.limit || 100), 1), 250);

    const { data, error } = await supabaseAdmin
      .from("user_alerts")
      .select(
        "*, item:items(id,title,description,group_key,status_id,status_key,item_type_id,metadata,assigned_to,updated_at,created_at,updated_date,created_date,status:item_statuses!items_status_id_fkey(id,label,group_key,status_key),item_type:item_types!items_item_type_id_fkey(id,label))",
      )
      .eq("workspace_id", access.workspace.id)
      .eq("user_id", access.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("listAlerts query error:", error);
      return json({ error: "Failed to list alerts" }, 500);
    }

    const alertRows = Array.isArray(data) ? data : [];
    const itemIds = alertRows.map((row) => String(row.item_id || "")).filter(Boolean);

    const { data: groupRows, error: groupRowsError } = await supabaseAdmin
      .from("item_status_groups")
      .select("group_key, display_name, color_hex")
      .eq("workspace_id", access.workspace.id);
    if (groupRowsError) {
      console.error("listAlerts group lookup error:", groupRowsError);
      return json({ error: "Failed to list alerts" }, 500);
    }
    const groupMap = new Map<string, { display_name: string; color_hex: string }>();
    (groupRows || []).forEach((row) => {
      groupMap.set(String(row.group_key || ""), {
        display_name: String(row.display_name || row.group_key),
        color_hex: String(row.color_hex || "#0F172A"),
      });
    });

    const watcherRowsByItemId = new Map<string, Array<{ user_id: string }>>();
    const watchedByItemId = new Set<string>();
    if (itemIds.length > 0) {
      const { data: watcherRows, error: watcherError } = await supabaseAdmin
        .from("item_watchers")
        .select("item_id, user_id")
        .eq("workspace_id", access.workspace.id)
        .in("item_id", itemIds);
      if (watcherError) {
        console.error("listAlerts watcher lookup error:", watcherError);
        return json({ error: "Failed to list alerts" }, 500);
      }
      (watcherRows || []).forEach((row) => {
        const key = String(row.item_id || "");
        const userId = String(row.user_id || "");
        const existing = watcherRowsByItemId.get(key) || [];
        existing.push({ user_id: userId });
        watcherRowsByItemId.set(key, existing);
        if (userId === access.user.id) {
          watchedByItemId.add(key);
        }
      });
    }

    const alerts = alertRows.map((row) => {
      const groupKey = String(row.item?.group_key || row.item?.status?.group_key || "");
      const groupMeta = groupMap.get(groupKey);
      const resolvedItem = row.item
        ? {
            ...row.item,
            status_label: row.item?.status?.label || row.item?.status_key || null,
            group_label: groupMeta?.display_name || groupKey,
            group_color: groupMeta?.color_hex || "#0F172A",
            item_type_label: row.item?.item_type?.label || null,
            watched: watchedByItemId.has(String(row.item?.id || "")),
            watcher_count: (watcherRowsByItemId.get(String(row.item?.id || "")) || []).length,
          }
        : null;
      return {
        ...row,
        item: resolvedItem,
      };
    });

    return json({ alerts });
  } catch (error) {
    console.error("listAlerts error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
