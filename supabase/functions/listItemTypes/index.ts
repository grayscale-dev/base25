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
    const access = await requireWorkspaceReadAccess(req, payload);
    if (!access.success) {
      return json({ error: access.error }, access.status || 403);
    }

    const onlyActive = payload?.active_only !== false;

    let query = supabaseAdmin
      .from("item_types")
      .select("*")
      .eq("workspace_id", access.workspace.id)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (onlyActive) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) {
      console.error("listItemTypes query error:", error);
      return json({ error: "Failed to load item types" }, 500);
    }

    return json({ item_types: data ?? [] });
  } catch (error) {
    console.error("listItemTypes error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
