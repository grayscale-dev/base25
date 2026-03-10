import { authorizeWriteAction } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { isValidGroupKey, validateMetadata } from "../_shared/itemValidation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WRITE_ACTION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const boardId = payload?.board_id;
    const groupKey = payload?.group_key;
    const statusKey = payload?.status_key;
    const title = payload?.title;
    const description = payload?.description ?? "";
    const metadata = payload?.metadata ?? {};
    const tags = Array.isArray(payload?.tags) ? payload.tags : [];
    const visibility = payload?.visibility ?? "public";

    if (!boardId || !isValidGroupKey(groupKey) || !statusKey || !title) {
      return json(
        { error: "Missing required fields", required: ["board_id", "group_key", "status_key", "title"] },
        400,
      );
    }

    const auth = await authorizeWriteAction(req, boardId, "contributor");
    if (!auth.success) {
      return auth.error;
    }

    const metadataCheck = validateMetadata(groupKey, metadata);
    if (!metadataCheck.valid) {
      return json({ error: metadataCheck.message }, 400);
    }

    const { data: statusRow, error: statusError } = await supabaseAdmin
      .from("item_statuses")
      .select("id, is_active")
      .eq("board_id", boardId)
      .eq("group_key", groupKey)
      .eq("status_key", statusKey)
      .limit(1)
      .maybeSingle();

    if (statusError) {
      console.error("createItem status lookup error:", statusError);
      return json({ error: "Failed to validate status" }, 500);
    }
    if (!statusRow || statusRow.is_active === false) {
      return json({ error: "status_key is not valid for this group" }, 400);
    }

    const { data: item, error: createError } = await supabaseAdmin
      .from("items")
      .insert({
        board_id: boardId,
        group_key: groupKey,
        status_key: statusKey,
        title: String(title).trim(),
        description: String(description || ""),
        metadata,
        tags,
        visibility,
        submitter_id: auth.user.id,
        submitter_email: auth.user.email,
      })
      .select("*")
      .single();

    if (createError) {
      console.error("createItem insert error:", createError);
      return json({ error: "Failed to create item" }, 500);
    }

    await supabaseAdmin.from("item_activities").insert({
      board_id: boardId,
      item_id: item.id,
      activity_type: "system",
      content: "Item created",
      metadata: {},
      author_id: auth.user.id,
      author_role: auth.role === "admin" ? "admin" : "user",
    });

    return json(item);
  } catch (error) {
    console.error("createItem error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
