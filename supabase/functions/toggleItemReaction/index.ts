import { authorizeWriteAction } from "../_shared/authHelpers.ts";
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

function normalizeEmoji(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > 16) return null;
  return normalized;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WRITE_ACTION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const workspaceId = String(payload?.workspace_id || "").trim();
    const itemId = String(payload?.item_id || "").trim();
    const emoji = normalizeEmoji(payload?.emoji);

    if (!workspaceId || !itemId || !emoji) {
      return json({ error: "workspace_id, item_id, and emoji are required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "contributor");
    if (!auth.success) return auth.error;

    const { data: item, error: itemError } = await supabaseAdmin
      .from("items")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", itemId)
      .limit(1)
      .maybeSingle();

    if (itemError) {
      console.error("toggleItemReaction item lookup error:", itemError);
      return json({ error: "Failed to update reaction" }, 500);
    }
    if (!item) {
      return json({ error: "Item not found" }, 404);
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("item_reactions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("item_id", itemId)
      .eq("user_id", auth.user.id)
      .eq("emoji", emoji)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("toggleItemReaction existing lookup error:", existingError);
      return json({ error: "Failed to update reaction" }, 500);
    }

    let reacted = false;
    if (existing?.id) {
      const { error: deleteError } = await supabaseAdmin.from("item_reactions").delete().eq("id", existing.id);
      if (deleteError) {
        console.error("toggleItemReaction delete error:", deleteError);
        return json({ error: "Failed to update reaction" }, 500);
      }
      reacted = false;
    } else {
      const { error: insertError } = await supabaseAdmin.from("item_reactions").insert({
        workspace_id: workspaceId,
        item_id: itemId,
        user_id: auth.user.id,
        emoji,
      });
      if (insertError) {
        console.error("toggleItemReaction insert error:", insertError);
        return json({ error: "Failed to update reaction" }, 500);
      }
      reacted = true;
    }

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("item_reactions")
      .select("emoji, user_id")
      .eq("workspace_id", workspaceId)
      .eq("item_id", itemId);

    if (rowsError) {
      console.error("toggleItemReaction aggregate error:", rowsError);
      return json({ error: "Failed to load reaction summary" }, 500);
    }

    const aggregate = new Map<string, { count: number; reacted: boolean }>();
    (rows || []).forEach((row) => {
      const key = String(row.emoji || "");
      const existingRow = aggregate.get(key) || { count: 0, reacted: false };
      existingRow.count += 1;
      if (String(row.user_id || "") === auth.user.id) {
        existingRow.reacted = true;
      }
      aggregate.set(key, existingRow);
    });

    return json({
      reacted,
      reactions: [...aggregate.entries()]
        .map(([emojiKey, value]) => ({ emoji: emojiKey, count: value.count, reacted: value.reacted }))
        .sort((a, b) => b.count - a.count),
      reaction_count: (rows || []).length,
    });
  } catch (error) {
    console.error("toggleItemReaction error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
