import Stripe from "https://esm.sh/stripe@14.20.0?target=deno";
import { supabaseAdmin } from "../_shared/supabase.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const reportingSecret = Deno.env.get("USAGE_REPORTING_SECRET") ?? "";
const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-reporting-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isAuthorized(req: Request) {
  if (!reportingSecret) return true;
  return req.headers.get("x-reporting-secret") === reportingSecret;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAuthorized(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({}));
    const startDate = payload.start_date as string | undefined;
    const endDate = payload.end_date as string | undefined;

    let query = supabaseAdmin
      .from("billing_usage_daily")
      .select("*")
      .eq("stripe_reported", false)
      .gt("billable_count", 0);

    if (startDate) query = query.gte("usage_date", startDate);
    if (endDate) query = query.lte("usage_date", endDate);

    const { data: usageRows, error } = await query;
    if (error) {
      console.error("Usage lookup error:", error);
      return new Response(JSON.stringify({ error: "Failed to load usage" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = usageRows || [];
    const results = [];

    for (const row of rows) {
      const { data: billingRow } = await supabaseAdmin
        .from("billing_customers")
        .select("stripe_subscription_item_id")
        .eq("board_id", row.board_id)
        .maybeSingle();

      if (!billingRow?.stripe_subscription_item_id) {
        continue;
      }

      const timestamp = new Date(`${row.usage_date}T23:59:59Z`).getTime() / 1000;
      const idempotencyKey = `${row.board_id}:${row.usage_date}`;

      try {
        const usageRecord = await stripe.subscriptionItems.createUsageRecord(
          billingRow.stripe_subscription_item_id,
          {
            quantity: row.billable_count,
            timestamp,
            action: "increment",
          },
          { idempotencyKey },
        );

        await supabaseAdmin
          .from("billing_usage_daily")
          .update({
            stripe_reported: true,
            stripe_reported_at: new Date().toISOString(),
            stripe_usage_record_id: usageRecord.id,
          })
          .eq("board_id", row.board_id)
          .eq("usage_date", row.usage_date);

        await supabaseAdmin.from("billing_usage_reports").upsert({
          board_id: row.board_id,
          usage_date: row.usage_date,
          quantity: row.billable_count,
          stripe_usage_record_id: usageRecord.id,
          status: "reported",
          reported_at: new Date().toISOString(),
        });

        results.push({ board_id: row.board_id, usage_date: row.usage_date, status: "reported" });
      } catch (reportError) {
        console.error("Usage report error:", reportError);
        await supabaseAdmin.from("billing_usage_reports").upsert({
          board_id: row.board_id,
          usage_date: row.usage_date,
          quantity: row.billable_count,
          status: "failed",
          error_message: reportError.message ?? "unknown error",
        });
        results.push({ board_id: row.board_id, usage_date: row.usage_date, status: "failed" });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Report usage error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
