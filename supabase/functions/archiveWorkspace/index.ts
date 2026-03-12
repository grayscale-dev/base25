import Stripe from "https://esm.sh/stripe@14.20.0?target=deno";
import { requireAdmin, requireAuth, verifyWorkspace } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" }) : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BILLABLE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);
const TERMINAL_STRIPE_STATUSES = new Set(["canceled", "incomplete_expired"]);

function isMissingStripeEntityError(error: unknown, entity: "customer" | "subscription") {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.toLowerCase().includes(`no such ${entity}`);
}

async function cancelWorkspaceStripeSubscriptions(billingRow: {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}) {
  if (!stripe) {
    return {
      ok: false,
      message: "Stripe is not configured. Cancel billing in Stripe first, then retry workspace deletion.",
    };
  }

  const candidateSubscriptionIds = new Set<string>();
  if (billingRow?.stripe_subscription_id) {
    candidateSubscriptionIds.add(String(billingRow.stripe_subscription_id));
  }

  if (billingRow?.stripe_customer_id) {
    try {
      const listed = await stripe.subscriptions.list({
        customer: String(billingRow.stripe_customer_id),
        status: "all",
        limit: 100,
      });
      (listed.data || []).forEach((subscription) => {
        if (subscription?.id) {
          candidateSubscriptionIds.add(String(subscription.id));
        }
      });
    } catch (listError) {
      if (!isMissingStripeEntityError(listError, "customer")) {
        const detail = listError instanceof Error ? listError.message : String(listError || "");
        return {
          ok: false,
          message: `Unable to list Stripe subscriptions (${detail}). Cancel billing in Stripe first, then retry.`,
        };
      }
    }
  }

  let cancellationAttempted = 0;
  for (const subscriptionId of candidateSubscriptionIds) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (!subscription?.id) continue;
      if (TERMINAL_STRIPE_STATUSES.has(String(subscription.status || "").toLowerCase())) {
        continue;
      }
      cancellationAttempted += 1;
      await stripe.subscriptions.cancel(subscription.id);
    } catch (subscriptionError) {
      if (isMissingStripeEntityError(subscriptionError, "subscription")) {
        continue;
      }
      const detail = subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError || "");
      return {
        ok: false,
        message: `Unable to cancel Stripe subscription (${detail}). Cancel billing in Stripe first, then retry.`,
      };
    }
  }

  return {
    ok: true,
    cancellationAttempted,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return new Response(authCheck.error.body, {
        status: authCheck.error.status,
        headers: corsHeaders,
      });
    }

    const payload = await req.json().catch(() => ({}));
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

    const permissionCheck = await requireAdmin(workspaceId, authCheck.user.id);
    if (!permissionCheck.success) {
      return new Response(permissionCheck.error.body, {
        status: permissionCheck.error.status,
        headers: corsHeaders,
      });
    }

    if (permissionCheck.role !== "owner") {
      return json(
        {
          error: "Only the workspace owner can delete this workspace",
          code: "OWNER_REQUIRED_FOR_DELETE",
        },
        403,
      );
    }

    const { data: billingRow, error: billingLookupError } = await supabaseAdmin
      .from("billing_customers")
      .select("id, stripe_customer_id, stripe_subscription_id, status")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (billingLookupError) {
      console.error("archiveWorkspace billing lookup error:", billingLookupError);
      return json({ error: "Unable to verify billing status before deletion" }, 500);
    }

    const billingStatus = String(billingRow?.status || "inactive").toLowerCase();
    const requiresBillingCancellation = BILLABLE_STATUSES.has(billingStatus);
    if (requiresBillingCancellation) {
      const cancellationResult = await cancelWorkspaceStripeSubscriptions({
        stripe_customer_id: billingRow?.stripe_customer_id,
        stripe_subscription_id: billingRow?.stripe_subscription_id,
      });

      if (!cancellationResult.ok) {
        return json(
          {
            error: cancellationResult.message,
            code: "BILLING_CANCELLATION_REQUIRED",
          },
          409,
        );
      }

      if (!cancellationResult.cancellationAttempted) {
        return json(
          {
            error:
              "Active billing must be canceled before deleting this workspace. Please cancel the Stripe subscription and retry.",
            code: "BILLING_CANCELLATION_REQUIRED",
          },
          409,
        );
      }

      const nowIso = new Date().toISOString();
      const { error: billingUpdateError } = await supabaseAdmin
        .from("billing_customers")
        .update({
          status: "canceled",
          cancel_at_period_end: false,
          canceled_at: nowIso,
          current_period_end: nowIso,
          stripe_subscription_id: null,
        })
        .eq("workspace_id", workspaceId);

      if (billingUpdateError) {
        console.error("archiveWorkspace billing update error:", billingUpdateError);
        return json({ error: "Unable to finalize billing cancellation before deletion" }, 500);
      }
    }

    const { error: archiveError } = await supabaseAdmin
      .from("workspaces")
      .update({ status: "archived" })
      .eq("id", workspaceId);

    if (archiveError) {
      console.error("archiveWorkspace update error:", archiveError);
      return json({ error: "Failed to archive workspace" }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("archiveWorkspace unexpected error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
