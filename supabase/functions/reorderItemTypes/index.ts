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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WRITE_ACTION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const workspaceId = payload?.workspace_id;
    const orderedTypeIds = Array.isArray(payload?.ordered_type_ids)
      ? payload.ordered_type_ids.filter((value: unknown) => typeof value === "string")
      : [];

    if (!workspaceId || orderedTypeIds.length === 0) {
      return json({ error: "workspace_id and ordered_type_ids are required" }, 400);
    }

    const auth = await authorizeWriteAction(req, workspaceId, "admin");
    if (!auth.success) return auth.error;

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("item_types")
      .select("id")
      .eq("workspace_id", workspaceId);

    if (existingError) {
      console.error("reorderItemTypes lookup error:", existingError);
      return json({ error: "Failed to load item types" }, 500);
    }

    const existingIds = new Set((existingRows || []).map((row) => row.id));
    if (orderedTypeIds.some((id: string) => !existingIds.has(id))) {
      return json({ error: "ordered_type_ids contains an unknown item type" }, 400);
    }

    const updates = orderedTypeIds.map((itemTypeId: string, index: number) =>
      supabaseAdmin
        .from("item_types")
        .update({ display_order: index })
        .eq("workspace_id", workspaceId)
        .eq("id", itemTypeId)
    );

    const results = await Promise.all(updates);
    const failure = results.find((result) => result.error);
    if (failure?.error) {
      console.error("reorderItemTypes update error:", failure.error);
      return json({ error: "Failed to reorder item types" }, 500);
    }

    const { data: refreshedRows, error: refreshedError } = await supabaseAdmin
      .from("item_types")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (refreshedError) {
      console.error("reorderItemTypes refresh error:", refreshedError);
      return json({ error: "Failed to reload item types" }, 500);
    }

    return json({ item_types: refreshedRows || [] });
  } catch (error) {
    console.error("reorderItemTypes error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
