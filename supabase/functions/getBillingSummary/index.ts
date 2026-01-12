import { requireAuth, requireAdmin } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const boardId = payload.board_id;

    if (!boardId) {
      return new Response(JSON.stringify({ error: "Missing board_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminCheck = await requireAdmin(boardId, authCheck.user.id);
    if (!adminCheck.success) {
      return new Response(adminCheck.error.body, {
        status: adminCheck.error.status,
        headers: corsHeaders,
      });
    }

    const { data: billingRow } = await supabaseAdmin
      .from("billing_customers")
      .select("*")
      .eq("board_id", boardId)
      .maybeSingle();

    const { data: services } = await supabaseAdmin
      .from("billing_services")
      .select("service, enabled")
      .eq("board_id", boardId);

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

    const { data: usageDaily } = await supabaseAdmin
      .from("billing_usage_daily")
      .select("usage_date, total_count, billable_count")
      .eq("board_id", boardId)
      .gte("usage_date", periodStart.slice(0, 10))
      .lte("usage_date", periodEnd.slice(0, 10));

    const interactionsTotal = (usageDaily || []).reduce(
      (sum, row) => sum + (row.total_count || 0),
      0,
    );
    const billableTotal = (usageDaily || []).reduce(
      (sum, row) => sum + (row.billable_count || 0),
      0,
    );

    const serviceCost = enabledServices.length * 5;
    const overageCost = billableTotal * 0.002;

    return new Response(
      JSON.stringify({
        status: billingRow?.status ?? "inactive",
        trial_end: billingRow?.trial_end ?? null,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        enabled_services: enabledServices,
        interactions_total: interactionsTotal,
        billable_interactions: billableTotal,
        service_cost: serviceCost,
        overage_cost: overageCost,
        estimated_total: serviceCost + overageCost,
        beta_access_granted_at: billingRow?.beta_access_granted_at ?? null,
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
