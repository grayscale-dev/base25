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

function normalizeQuery(value: unknown) {
  return String(value || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const query = normalizeQuery(payload?.query ?? payload?.q);
    if (!query) {
      return json({ results: [] });
    }

    const access = await requireWorkspaceReadAccess(req, payload);
    if (!access.success) {
      return json({ error: access.error }, access.status || 403);
    }

    const workspaceId = access.workspace.id;
    const limit = Math.min(Math.max(Number(payload?.limit || 50), 1), 150);
    const pattern = `%${query}%`;

    let itemsQuery = supabaseAdmin
      .from("items")
      .select("id, title, description, group_key")
      .eq("workspace_id", workspaceId)
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .limit(200);

    if (access.isPublicAccess) {
      itemsQuery = itemsQuery.eq("visibility", "public");
    }

    const activityTypeScope = access.role === "contributor"
      ? ["comment", "status_change", "type_change"]
      : [
          "comment",
          "update",
          "status_change",
          "group_change",
          "type_change",
          "priority_change",
          "assignee_change",
          "system",
        ];

    let activityQuery = supabaseAdmin
      .from("item_activities")
      .select("item_id, content")
      .eq("workspace_id", workspaceId)
      .ilike("content", pattern)
      .in("activity_type", activityTypeScope)
      .limit(250);

    if (access.isPublicAccess) {
      activityQuery = activityQuery.eq("is_internal_note", false);
    }

    const [itemMatchesResult, activityMatchesResult] = await Promise.all([itemsQuery, activityQuery]);

    if (itemMatchesResult.error || activityMatchesResult.error) {
      console.error("searchWorkspaceItems query error:", itemMatchesResult.error || activityMatchesResult.error);
      return json({ error: "Search failed" }, 500);
    }

    const matchMap = new Map<string, { matchedIn: Set<string>; preview: string }>();

    (itemMatchesResult.data || []).forEach((item) => {
      const itemId = String(item.id || "");
      if (!itemId) return;
      const titleMatch = String(item.title || "").toLowerCase().includes(query.toLowerCase());
      const descriptionMatch = String(item.description || "").toLowerCase().includes(query.toLowerCase());
      const existing = matchMap.get(itemId) || { matchedIn: new Set<string>(), preview: "" };
      if (titleMatch) existing.matchedIn.add("title");
      if (descriptionMatch) existing.matchedIn.add("description");
      if (!existing.preview) {
        existing.preview = String(item.description || item.title || "").slice(0, 220);
      }
      matchMap.set(itemId, existing);
    });

    (activityMatchesResult.data || []).forEach((row) => {
      const itemId = String(row.item_id || "");
      if (!itemId) return;
      const existing = matchMap.get(itemId) || { matchedIn: new Set<string>(), preview: "" };
      existing.matchedIn.add("comments");
      if (!existing.preview) {
        existing.preview = String(row.content || "").slice(0, 220);
      }
      matchMap.set(itemId, existing);
    });

    const itemIds = [...matchMap.keys()];
    if (itemIds.length === 0) {
      return json({ results: [] });
    }

    let resultsQuery = supabaseAdmin
      .from("items")
      .select("*, status:item_statuses!items_status_id_fkey(id,label,group_key,status_key), item_type:item_types!items_item_type_id_fkey(id,label)")
      .eq("workspace_id", workspaceId)
      .in("id", itemIds)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (access.isPublicAccess) {
      resultsQuery = resultsQuery.eq("visibility", "public");
    }

    const { data: resultItems, error: resultItemsError } = await resultsQuery;
    if (resultItemsError) {
      console.error("searchWorkspaceItems result lookup error:", resultItemsError);
      return json({ error: "Search failed" }, 500);
    }

    const { data: groupRows, error: groupRowsError } = await supabaseAdmin
      .from("item_status_groups")
      .select("group_key, display_name, color_hex")
      .eq("workspace_id", workspaceId);

    if (groupRowsError) {
      console.error("searchWorkspaceItems group lookup error:", groupRowsError);
      return json({ error: "Search failed" }, 500);
    }

    const groupMap = new Map<string, { display_name: string; color_hex: string }>();
    (groupRows || []).forEach((row) => {
      groupMap.set(String(row.group_key), {
        display_name: String(row.display_name || row.group_key),
        color_hex: String(row.color_hex || "#0F172A"),
      });
    });

    const results = (resultItems || []).map((row) => {
      const groupKey = String(row.group_key || row.status?.group_key || "");
      const groupMeta = groupMap.get(groupKey);
      const matchState = matchMap.get(String(row.id || ""));
      return {
        ...row,
        status_label: row.status?.label || row.status_key,
        group_label: groupMeta?.display_name || groupKey,
        group_color: groupMeta?.color_hex || "#0F172A",
        item_type_label: row.item_type?.label || null,
        matched_in: matchState ? [...matchState.matchedIn.values()] : [],
        match_preview: matchState?.preview || "",
      };
    });

    return json({ results, query });
  } catch (error) {
    console.error("searchWorkspaceItems error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
