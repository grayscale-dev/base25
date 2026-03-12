import { supabaseAdmin } from "../_shared/supabase.ts";
import { requireWorkspaceReadAccess } from "../_shared/itemAccess.ts";
import { isValidGroupKey } from "../_shared/itemValidation.ts";
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

function buildReactionSummary(
  rows: Array<{ emoji: string; user_id: string }>,
  currentUserId: string | null,
) {
  const aggregate = new Map<string, { count: number; reacted: boolean }>();
  rows.forEach((row) => {
    const emoji = String(row.emoji || "");
    if (!emoji) return;
    const prev = aggregate.get(emoji) || { count: 0, reacted: false };
    prev.count += 1;
    if (currentUserId && String(row.user_id || "") === currentUserId) {
      prev.reacted = true;
    }
    aggregate.set(emoji, prev);
  });

  return [...aggregate.entries()]
    .map(([emoji, value]) => ({ emoji, count: value.count, reacted: value.reacted }))
    .sort((a, b) => b.count - a.count);
}

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

    const groupKey = payload.group_key;
    if (groupKey && !isValidGroupKey(groupKey)) {
      return json({ error: "group_key is invalid" }, 400);
    }

    const limit = Math.min(Math.max(Number(payload.limit || 50), 1), 200);
    const statusId =
      typeof payload.status_id === "string" ? String(payload.status_id) : null;
    const watchedOnly = payload?.watched_only === true || payload?.watched_only === "true";

    let query = supabaseAdmin
      .from("items")
      .select("*, status:item_statuses!items_status_id_fkey(id,label,group_key,status_key), item_type:item_types!items_item_type_id_fkey(id,label)")
      .eq("workspace_id", access.workspace.id);

    if (groupKey) query = query.eq("group_key", groupKey);
    if (statusId) query = query.eq("status_id", statusId);
    if (access.isPublicAccess) query = query.eq("visibility", "public");
    if (watchedOnly) {
      if (!access.user?.id) {
        return json({
          items: [],
          workspace: {
            id: access.workspace.id,
            slug: access.workspace.slug,
            visibility: access.workspace.visibility,
          },
        });
      }
      const { data: watchedRows, error: watchedRowsError } = await supabaseAdmin
        .from("item_watchers")
        .select("item_id")
        .eq("workspace_id", access.workspace.id)
        .eq("user_id", access.user.id);

      if (watchedRowsError) {
        console.error("listItems watched lookup error:", watchedRowsError);
        return json({ error: "Failed to list items" }, 500);
      }

      const watchedItemIds = (watchedRows || []).map((row) => String(row.item_id || "")).filter(Boolean);
      if (watchedItemIds.length === 0) {
        return json({
          items: [],
          workspace: {
            id: access.workspace.id,
            slug: access.workspace.slug,
            visibility: access.workspace.visibility,
          },
        });
      }
      query = query.in("id", watchedItemIds);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("listItems query error:", error);
      return json({ error: "Failed to list items" }, 500);
    }

    const groupRowsResult = await supabaseAdmin
      .from("item_status_groups")
      .select("group_key, display_name, color_hex")
      .eq("workspace_id", access.workspace.id);

    if (groupRowsResult.error) {
      console.error("listItems group lookup error:", groupRowsResult.error);
      return json({ error: "Failed to list items" }, 500);
    }

    const groupMap = new Map<string, { display_name: string; color_hex: string }>();
    (groupRowsResult.data || []).forEach((row) => {
      groupMap.set(String(row.group_key), {
        display_name: String(row.display_name || row.group_key),
        color_hex: String(row.color_hex || "#0F172A"),
      });
    });

    const items = (data ?? []).map((row) => {
      const groupKeyValue = String(row.group_key || row.status?.group_key || "");
      const groupMeta = groupMap.get(groupKeyValue);
      return {
        ...row,
        status_label: row.status?.label || row.status_key,
        group_label: groupMeta?.display_name || groupKeyValue,
        group_color: groupMeta?.color_hex || "#0F172A",
        item_type_label: row.item_type?.label || null,
      };
    });

    const itemIds = items.map((item) => String(item.id || "")).filter(Boolean);
    const reactionRowsByItemId = new Map<string, Array<{ emoji: string; user_id: string }>>();
    const watcherRowsByItemId = new Map<string, Array<{ user_id: string }>>();
    const watchedByItemId = new Set<string>();
    if (itemIds.length > 0) {
      const { data: reactionRows, error: reactionError } = await supabaseAdmin
        .from("item_reactions")
        .select("item_id, emoji, user_id")
        .eq("workspace_id", access.workspace.id)
        .in("item_id", itemIds);
      if (reactionError) {
        console.error("listItems reaction lookup error:", reactionError);
        return json({ error: "Failed to list items" }, 500);
      }
      (reactionRows || []).forEach((row) => {
        const key = String(row.item_id || "");
        const existing = reactionRowsByItemId.get(key) || [];
        existing.push({
          emoji: String(row.emoji || ""),
          user_id: String(row.user_id || ""),
        });
        reactionRowsByItemId.set(key, existing);
      });

      const { data: watcherRows, error: watcherError } = await supabaseAdmin
        .from("item_watchers")
        .select("item_id, user_id")
        .eq("workspace_id", access.workspace.id)
        .in("item_id", itemIds);
      if (watcherError) {
        console.error("listItems watcher lookup error:", watcherError);
        return json({ error: "Failed to list items" }, 500);
      }
      (watcherRows || []).forEach((row) => {
        const key = String(row.item_id || "");
        const userId = String(row.user_id || "");
        const existing = watcherRowsByItemId.get(key) || [];
        existing.push({ user_id: userId });
        watcherRowsByItemId.set(key, existing);
        if (access.user?.id && userId === access.user.id) {
          watchedByItemId.add(key);
        }
      });
    }

    return json({
      items: items.map((item) => ({
        ...item,
        reaction_count: (reactionRowsByItemId.get(String(item.id || "")) || []).length,
        reaction_summary: buildReactionSummary(
          reactionRowsByItemId.get(String(item.id || "")) || [],
          access.user?.id || null,
        ),
        watched: watchedByItemId.has(String(item.id || "")),
        watcher_count: (watcherRowsByItemId.get(String(item.id || "")) || []).length,
      })),
      workspace: {
        id: access.workspace.id,
        slug: access.workspace.slug,
        visibility: access.workspace.visibility,
      },
    });
  } catch (error) {
    console.error("listItems error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
