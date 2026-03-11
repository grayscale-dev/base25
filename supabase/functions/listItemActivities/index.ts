import { supabaseAdmin } from "../_shared/supabase.ts";
import { requireWorkspaceReadAccess } from "../_shared/itemAccess.ts";
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
    const itemId = payload?.item_id;
    if (!itemId) {
      return json({ error: "item_id is required" }, 400);
    }

    const access = await requireWorkspaceReadAccess(req, payload);
    if (!access.success) {
      return json({ error: access.error }, access.status || 403);
    }

    const limit = Math.min(Math.max(Number(payload.limit || 100), 1), 300);
    let query = supabaseAdmin
      .from("item_activities")
      .select("*")
      .eq("workspace_id", access.workspace.id)
      .eq("item_id", itemId);

    if (access.isPublicAccess) {
      query = query.eq("is_internal_note", false);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
    if (error) {
      console.error("listItemActivities query error:", error);
      return json({ error: "Failed to list activities" }, 500);
    }

    return json({ activities: data ?? [] });
  } catch (error) {
    console.error("listItemActivities error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
