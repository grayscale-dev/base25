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

function buildReactionSummary(
  rows: Array<{ emoji: string; user_id: string }>,
  currentUserId: string,
) {
  const aggregate = new Map<string, { count: number; reacted: boolean }>();
  rows.forEach((row) => {
    const emoji = String(row.emoji || "");
    const prev = aggregate.get(emoji) || { count: 0, reacted: false };
    prev.count += 1;
    if (String(row.user_id || "") === currentUserId) {
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
    const itemId = String(payload?.item_id || "").trim();

    if (!itemId) {
      return json({ error: "item_id is required" }, 400);
    }

    const access = await requireWorkspaceReadAccess(req, payload);
    if (!access.success) {
      return json({ error: access.error }, access.status || 403);
    }

    if (!access.user?.id) {
      return json({ error: "Authentication required" }, 401);
    }

    const workspaceId = access.workspace.id;
    const userId = access.user.id;

    const { data: item, error: itemError } = await supabaseAdmin
      .from("items")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", itemId)
      .limit(1)
      .maybeSingle();

    if (itemError) {
      console.error("getItemEngagement item lookup error:", itemError);
      return json({ error: "Failed to load engagement" }, 500);
    }
    if (!item) {
      return json({ error: "Item not found" }, 404);
    }

    const [
      { count: watcherCount, error: watcherCountError },
      { data: watcherRow, error: watcherStateError },
      { data: itemReactionRows, error: itemReactionError },
      { data: commentRows, error: commentRowsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("item_watchers")
        .select("id", { head: true, count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("item_id", itemId),
      supabaseAdmin
        .from("item_watchers")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("item_id", itemId)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("item_reactions")
        .select("emoji, user_id")
        .eq("workspace_id", workspaceId)
        .eq("item_id", itemId),
      supabaseAdmin
        .from("item_activities")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("item_id", itemId)
        .eq("activity_type", "comment"),
    ]);

    if (watcherCountError || watcherStateError || itemReactionError || commentRowsError) {
      console.error(
        "getItemEngagement query error:",
        watcherCountError || watcherStateError || itemReactionError || commentRowsError,
      );
      return json({ error: "Failed to load engagement" }, 500);
    }

    const commentIds = (commentRows || []).map((row) => String(row.id || "")).filter(Boolean);
    let commentReactionsRaw: Array<{ item_activity_id: string; emoji: string; user_id: string }> = [];

    if (commentIds.length > 0) {
      const { data: commentReactions, error: commentReactionError } = await supabaseAdmin
        .from("item_activity_reactions")
        .select("item_activity_id, emoji, user_id")
        .eq("workspace_id", workspaceId)
        .in("item_activity_id", commentIds);
      if (commentReactionError) {
        console.error("getItemEngagement comment reactions error:", commentReactionError);
        return json({ error: "Failed to load engagement" }, 500);
      }
      commentReactionsRaw = commentReactions || [];
    }

    const commentReactionMap = new Map<string, Array<{ emoji: string; count: number; reacted: boolean }>>();
    commentIds.forEach((commentId) => {
      const rows = commentReactionsRaw
        .filter((entry) => String(entry.item_activity_id || "") === commentId)
        .map((entry) => ({ emoji: String(entry.emoji || ""), user_id: String(entry.user_id || "") }));
      commentReactionMap.set(commentId, buildReactionSummary(rows, userId));
    });

    return json({
      watched: Boolean(watcherRow?.id),
      watcher_count: watcherCount || 0,
      item_reactions: buildReactionSummary(
        (itemReactionRows || []).map((row) => ({ emoji: String(row.emoji || ""), user_id: String(row.user_id || "") })),
        userId,
      ),
      item_reaction_count: (itemReactionRows || []).length,
      comment_reactions: Object.fromEntries(commentReactionMap.entries()),
    });
  } catch (error) {
    console.error("getItemEngagement error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
