import { requireAuth, requireOwner } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const FLAT_MONTHLY_PRICE = 30;

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

    const ownerCheck = await requireOwner(workspaceId, authCheck.user.id);
    if (!ownerCheck.success) {
      return new Response(ownerCheck.error.body, {
        status: ownerCheck.error.status,
        headers: corsHeaders,
      });
    }

    const { data: billingRow } = await supabaseAdmin
      .from("billing_customers")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    let periodStart = billingRow?.current_period_start;
    let periodEnd = billingRow?.current_period_end;
    const now = new Date();

    if (!periodStart || !periodEnd) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      periodStart = start.toISOString();
      periodEnd = end.toISOString();
    }

    const status = billingRow?.status ?? "inactive";
    const isActiveSubscription = ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(status);
    const activeServiceCount = isActiveSubscription ? 1 : 0;
    const serviceCost = isActiveSubscription ? FLAT_MONTHLY_PRICE : 0;

    return new Response(
      JSON.stringify({
        status,
        trial_end: billingRow?.trial_end ?? null,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        enabled_services: [],
        active_service_count: activeServiceCount,
        service_unit_price: FLAT_MONTHLY_PRICE,
        service_cost: serviceCost,
        plan_monthly_price: FLAT_MONTHLY_PRICE,
        billing_model: "flat_monthly",
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
