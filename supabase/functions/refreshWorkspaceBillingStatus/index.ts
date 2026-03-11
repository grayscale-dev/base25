import Stripe from "https://esm.sh/stripe@14.20.0?target=deno";
import { requireAuth, requireMinimumRole, verifyWorkspace } from "../_shared/authHelpers.ts";
import { isBillingAccessAllowed } from "../_shared/billing.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function pickBestSubscription(subscriptions: Stripe.Subscription[]) {
  if (!subscriptions.length) return null;

  const preferredStatuses = ["active", "trialing", "past_due", "unpaid", "incomplete"];
  for (const status of preferredStatuses) {
    const match = subscriptions.find((entry) => entry.status === status);
    if (match) return match;
  }

  return subscriptions[0];
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (!stripeSecretKey) {
      return json({ error: "Stripe is not configured" }, 500);
    }

    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return new Response(authCheck.error.body, {
        status: authCheck.error.status,
        headers: corsHeaders,
      });
    }

    const payload = await req.json();
    const workspaceId = String(payload?.workspace_id || "").trim();
    if (!workspaceId) {
      return json({ error: "workspace_id is required" }, 400);
    }

    const workspaceCheck = await verifyWorkspace(workspaceId);
    if (!workspaceCheck.success) {
      return new Response(workspaceCheck.error.body, {
        status: workspaceCheck.error.status,
        headers: corsHeaders,
      });
    }

    const roleCheck = await requireMinimumRole(workspaceId, authCheck.user.id, "contributor");
    if (!roleCheck.success) {
      return new Response(roleCheck.error.body, {
        status: roleCheck.error.status,
        headers: corsHeaders,
      });
    }

    const { data: billingRow, error: billingError } = await supabaseAdmin
      .from("billing_customers")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (billingError) {
      console.error("refreshWorkspaceBillingStatus billing lookup error:", billingError);
      return json({ error: "Failed to refresh billing status" }, 500);
    }

    if (!billingRow?.stripe_customer_id) {
      const status = String(billingRow?.status || "inactive").toLowerCase();
      return json({
        billing_status: status,
        billing_access_allowed: isBillingAccessAllowed(status),
      });
    }

    let selectedSubscription: Stripe.Subscription | null = null;
    if (billingRow.stripe_subscription_id) {
      try {
        selectedSubscription = await stripe.subscriptions.retrieve(String(billingRow.stripe_subscription_id));
      } catch (subscriptionError) {
        console.error("refreshWorkspaceBillingStatus retrieve subscription error:", subscriptionError);
      }
    }

    if (!selectedSubscription) {
      try {
        const listed = await stripe.subscriptions.list({
          customer: String(billingRow.stripe_customer_id),
          status: "all",
          limit: 10,
        });
        selectedSubscription = pickBestSubscription(listed.data || []);
      } catch (listError) {
        console.error("refreshWorkspaceBillingStatus list subscriptions error:", listError);
      }
    }

    const status = String(selectedSubscription?.status || "inactive").toLowerCase();

    const upsertPayload = {
      workspace_id: workspaceId,
      stripe_customer_id: billingRow.stripe_customer_id,
      stripe_subscription_id: selectedSubscription?.id || billingRow.stripe_subscription_id || null,
      status,
      trial_end: selectedSubscription?.trial_end
        ? new Date(selectedSubscription.trial_end * 1000).toISOString()
        : null,
      current_period_start: selectedSubscription?.current_period_start
        ? new Date(selectedSubscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: selectedSubscription?.current_period_end
        ? new Date(selectedSubscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: selectedSubscription?.cancel_at_period_end ?? false,
      canceled_at: selectedSubscription?.canceled_at
        ? new Date(selectedSubscription.canceled_at * 1000).toISOString()
        : null,
    };

    const { error: upsertError } = await supabaseAdmin
      .from("billing_customers")
      .upsert(upsertPayload);

    if (upsertError) {
      console.error("refreshWorkspaceBillingStatus upsert error:", upsertError);
      return json({ error: "Failed to refresh billing status" }, 500);
    }

    return json({
      billing_status: status,
      billing_access_allowed: isBillingAccessAllowed(status),
      stripe_subscription_id: upsertPayload.stripe_subscription_id,
    });
  } catch (error) {
    console.error("refreshWorkspaceBillingStatus error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
