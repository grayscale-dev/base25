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

    let query = supabaseAdmin
      .from("items")
      .select("*, status:item_statuses!items_status_id_fkey(id,label,group_key,status_key), item_type:item_types!items_item_type_id_fkey(id,label)")
      .eq("workspace_id", access.workspace.id);

    if (groupKey) query = query.eq("group_key", groupKey);
    if (statusId) query = query.eq("status_id", statusId);
    if (access.isPublicAccess) query = query.eq("visibility", "public");

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

    return json({
      items,
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
