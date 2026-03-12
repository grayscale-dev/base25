import { requireAuth, getUserWorkspaceRole } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { getWorkspaceBillingAccessState } from "../_shared/billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ITEM_GROUP_KEYS = ["feedback", "roadmap", "changelog"];

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
  if (rateLimitResponse) {
    return new Response(rateLimitResponse.body, {
      status: rateLimitResponse.status,
      headers: corsHeaders,
    });
  }

  try {
    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return new Response(authCheck.error.body, {
        status: authCheck.error.status,
        headers: corsHeaders,
      });
    }

    const payload = await req.json();
    const slug = String(payload?.slug || "").trim().toLowerCase();
    if (!slug) {
      return json({ error: "Workspace slug is required" }, 400);
    }

    const includeItems = payload?.include_items === true;
    const section = String(payload?.section || "").trim().toLowerCase();
    const statusId = typeof payload?.status_id === "string" ? String(payload.status_id).trim() : "";
    const limit = Math.min(Math.max(Number(payload?.limit || 50), 1), 200);

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (workspaceError) {
      console.error("workspaceBootstrap workspace lookup error:", workspaceError);
      return json({ error: "Internal server error" }, 500);
    }
    if (!workspace) {
      return json({ error: "Workspace not found" }, 404);
    }

    let resolvedRole = await getUserWorkspaceRole(workspace.id, authCheck.user.id);
    let isPublicAccess = false;

    if (!resolvedRole) {
      if (workspace.visibility !== "public") {
        return json({ error: "This workspace is not accessible" }, 403);
      }

      const { data: insertedRole, error: insertRoleError } = await supabaseAdmin
        .from("workspace_roles")
        .upsert(
          {
            workspace_id: workspace.id,
            user_id: authCheck.user.id,
            email: authCheck.user.email,
            role: "contributor",
          },
          { onConflict: "workspace_id,user_id" },
        )
        .select("role")
        .single();

      if (insertRoleError) {
        console.error("workspaceBootstrap role upsert error:", insertRoleError);
        return json({ error: "Unable to join workspace" }, 500);
      }

      resolvedRole = insertedRole?.role || "contributor";
      isPublicAccess = false;
    }

    const billing = await getWorkspaceBillingAccessState(workspace.id);

    const [groupsResult, statusesResult, itemTypesResult] = await Promise.all([
      supabaseAdmin
        .from("item_status_groups")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("display_order", { ascending: true }),
      supabaseAdmin
        .from("item_statuses")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabaseAdmin
        .from("item_types")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (groupsResult.error || statusesResult.error || itemTypesResult.error) {
      console.error(
        "workspaceBootstrap config query error:",
        groupsResult.error || statusesResult.error || itemTypesResult.error,
      );
      return json({ error: "Failed to load workspace bootstrap data" }, 500);
    }

    const groups = groupsResult.data ?? [];
    const statuses = statusesResult.data ?? [];
    const itemTypes = itemTypesResult.data ?? [];
    const groupMap = new Map<string, { display_name: string; color_hex: string }>();
    groups.forEach((group) => {
      groupMap.set(String(group.group_key || ""), {
        display_name: String(group.display_name || group.group_key),
        color_hex: String(group.color_hex || "#0F172A"),
      });
    });

    let items: Array<Record<string, unknown>> = [];
    if (includeItems) {
      const sectionGroupFilter = ITEM_GROUP_KEYS.includes(section) ? section : null;
      let itemQuery = supabaseAdmin
        .from("items")
        .select("*, status:item_statuses!items_status_id_fkey(id,label,group_key,status_key), item_type:item_types!items_item_type_id_fkey(id,label)")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (sectionGroupFilter) itemQuery = itemQuery.eq("group_key", sectionGroupFilter);
      if (statusId) itemQuery = itemQuery.eq("status_id", statusId);

      const { data: itemRows, error: itemError } = await itemQuery;
      if (itemError) {
        console.error("workspaceBootstrap items query error:", itemError);
        return json({ error: "Failed to load initial items" }, 500);
      }

      const itemIds = (itemRows || []).map((row) => String(row.id || "")).filter(Boolean);
      const reactionRowsByItemId = new Map<string, Array<{ emoji: string; user_id: string }>>();
      const watcherRowsByItemId = new Map<string, Array<{ user_id: string }>>();
      const watchedByItemId = new Set<string>();
      if (itemIds.length > 0) {
        const { data: reactionRows, error: reactionError } = await supabaseAdmin
          .from("item_reactions")
          .select("item_id, emoji, user_id")
          .eq("workspace_id", workspace.id)
          .in("item_id", itemIds);
        if (reactionError) {
          console.error("workspaceBootstrap reactions query error:", reactionError);
          return json({ error: "Failed to load initial items" }, 500);
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
          .eq("workspace_id", workspace.id)
          .in("item_id", itemIds);
        if (watcherError) {
          console.error("workspaceBootstrap watchers query error:", watcherError);
          return json({ error: "Failed to load initial items" }, 500);
        }
        (watcherRows || []).forEach((row) => {
          const key = String(row.item_id || "");
          const userId = String(row.user_id || "");
          const existing = watcherRowsByItemId.get(key) || [];
          existing.push({ user_id: userId });
          watcherRowsByItemId.set(key, existing);
          if (userId === authCheck.user.id) {
            watchedByItemId.add(key);
          }
        });
      }

      items = (itemRows || []).map((row) => {
        const groupKey = String(row.group_key || row.status?.group_key || "");
        const groupMeta = groupMap.get(groupKey);
        const reactionRows = reactionRowsByItemId.get(String(row.id || "")) || [];
        return {
          ...row,
          status_label: row.status?.label || row.status_key,
          group_label: groupMeta?.display_name || groupKey,
          group_color: groupMeta?.color_hex || "#0F172A",
          item_type_label: row.item_type?.label || null,
          reaction_count: reactionRows.length,
          reaction_summary: buildReactionSummary(reactionRows, authCheck.user.id),
          watched: watchedByItemId.has(String(row.id || "")),
          watcher_count: (watcherRowsByItemId.get(String(row.id || "")) || []).length,
        };
      });
    }

    const response = json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description || "",
      logo_url: workspace.logo_url || "",
      primary_color: workspace.primary_color || "#0f172a",
      visibility: workspace.visibility,
      role: resolvedRole,
      is_public_access: isPublicAccess,
      billing_status: billing.status,
      billing_access_allowed: billing.accessAllowed,
      groups,
      statuses,
      item_types: itemTypes,
      items,
    });

    return addCacheHeaders(response, 30);
  } catch (error) {
    console.error("workspaceBootstrap error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
