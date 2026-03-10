import { supabaseAdmin } from "../_shared/supabase.ts";
import { requireWorkspaceReadAccess } from "../_shared/itemAccess.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";

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

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const access = await requireWorkspaceReadAccess(req, payload);
    if (!access.success) {
      return json({ error: access.error }, access.status || 403);
    }

    const [groupsResult, statusesResult] = await Promise.all([
      supabaseAdmin
        .from("item_status_groups")
        .select("*")
        .eq("workspace_id", access.workspace.id)
        .order("display_order", { ascending: true }),
      supabaseAdmin
        .from("item_statuses")
        .select("*")
        .eq("workspace_id", access.workspace.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
    ]);

    if (groupsResult.error || statusesResult.error) {
      console.error("getItemStatusConfig query error:", groupsResult.error || statusesResult.error);
      return json({ error: "Failed to load status config" }, 500);
    }

    return json({
      groups: groupsResult.data ?? [],
      statuses: statusesResult.data ?? [],
    });
  } catch (error) {
    console.error("getItemStatusConfig error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
