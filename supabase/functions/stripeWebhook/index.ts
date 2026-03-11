import Stripe from "https://esm.sh/stripe@14.20.0?target=deno";
import { supabaseAdmin } from "../_shared/supabase.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const servicePriceIdsRaw = Deno.env.get("STRIPE_PRICE_SERVICE_IDS") ?? "{}";

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseServicePriceIds() {
  try {
    const parsed = JSON.parse(servicePriceIdsRaw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string>;
    }
  } catch {
    // fallthrough
  }

  const mapping: Record<string, string> = {};
  servicePriceIdsRaw.split(",").forEach((pair) => {
    const [service, priceId] = pair.split(":").map((value) => value.trim());
    if (service && priceId) {
      mapping[service] = priceId;
    }
  });
  return mapping;
}

function servicesFromSubscription(subscription: Stripe.Subscription) {
  const priceMap = parseServicePriceIds();
  const reverseMap = Object.entries(priceMap).reduce<Record<string, string>>(
    (acc, [service, priceId]) => {
      acc[priceId] = service;
      return acc;
    },
    {},
  );

  const enabled: string[] = [];

  subscription.items.data.forEach((item) => {
    const priceId = item.price?.id;
    if (!priceId) return;
    const service = reverseMap[priceId];
    if (service) {
      enabled.push(service);
    }
  });

  return { enabled };
}

async function upsertBillingServices(workspaceId: string, enabledServices: string[]) {
  const ALL_SERVICES = ["feedback", "roadmap", "changelog"];
  const rows = ALL_SERVICES.map((service) => ({
    workspace_id: workspaceId,
    service,
    enabled: enabledServices.includes(service),
  }));

  const { error } = await supabaseAdmin.from("billing_services").upsert(rows, {
    onConflict: "workspace_id,service",
  });
  if (error) {
    console.error("Billing services upsert error:", error);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (!stripeSecretKey || !webhookSecret) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signature = req.headers.get("stripe-signature") ?? "";
    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspace_id;
      const subscriptionId = session.subscription as string | null;
      const customerId = session.customer as string | null;

      if (workspaceId) {
        await supabaseAdmin.from("billing_customers").upsert({
          workspace_id: workspaceId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: "trialing",
        });
      }
    }

    if (event.type.startsWith("customer.subscription")) {
      const subscription = event.data.object as Stripe.Subscription;
      const workspaceId = subscription.metadata?.workspace_id;
      if (!workspaceId) {
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { enabled } = servicesFromSubscription(subscription);
      await upsertBillingServices(workspaceId, enabled);

      await supabaseAdmin.from("billing_customers").upsert({
        workspace_id: workspaceId,
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        current_period_start: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        canceled_at: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000).toISOString()
          : null,
      });
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      await supabaseAdmin
        .from("billing_customers")
        .update({ status: "past_due" })
        .eq("stripe_customer_id", customerId);
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      await supabaseAdmin
        .from("billing_customers")
        .update({ status: "active" })
        .eq("stripe_customer_id", customerId);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return new Response(JSON.stringify({ error: "Webhook handler failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
