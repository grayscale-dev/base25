import { requireAuth, requireAdmin } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SERVICE_PRICE = 25;

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return new Response(authCheck.error.body, {
        status: authCheck.error.status,
        headers: corsHeaders,
      });
    }

    const payload = await req.json();
    const workspaceId = payload.workspace_id;

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "Missing workspace_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminCheck = await requireAdmin(workspaceId, authCheck.user.id);
    if (!adminCheck.success) {
      return new Response(adminCheck.error.body, {
        status: adminCheck.error.status,
        headers: corsHeaders,
      });
    }

    const { data: billingRow } = await supabaseAdmin
      .from("billing_customers")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const { data: services } = await supabaseAdmin
      .from("billing_services")
      .select("service, enabled")
      .eq("workspace_id", workspaceId);

    const enabledServices = (services || []).filter((s) => s.enabled);

    let periodStart = billingRow?.current_period_start;
    let periodEnd = billingRow?.current_period_end;
    const now = new Date();

    if (!periodStart || !periodEnd) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      periodStart = start.toISOString();
      periodEnd = end.toISOString();
    }

    const activeServiceCount = enabledServices.length;
    const serviceCost = activeServiceCount * SERVICE_PRICE;

    return new Response(
      JSON.stringify({
        status: billingRow?.status ?? "inactive",
        trial_end: billingRow?.trial_end ?? null,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        enabled_services: enabledServices,
        active_service_count: activeServiceCount,
        service_unit_price: SERVICE_PRICE,
        service_cost: serviceCost,
        cancel_at_period_end: billingRow?.cancel_at_period_end ?? false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Get billing summary error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
