import Stripe from "https://esm.sh/stripe@14.20.0?target=deno";
import { requireAuth, requireAdmin, verifyWorkspace } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const servicePriceIdsRaw = Deno.env.get("STRIPE_PRICE_SERVICE_IDS") ?? "{}";

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALL_SERVICES = ["feedback", "roadmap", "changelog"];

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

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Stripe is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
    const enabledServices: string[] = payload.enabled_services || [];
    const successUrl = payload.success_url;
    const cancelUrl = payload.cancel_url;

    if (!workspaceId || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceCheck = await verifyWorkspace(workspaceId);
    if (!workspaceCheck.success) {
      return new Response(workspaceCheck.error.body, {
        status: workspaceCheck.error.status,
        headers: corsHeaders,
      });
    }

    const adminCheck = await requireAdmin(workspaceId, authCheck.user.id);
    if (!adminCheck.success) {
      return new Response(adminCheck.error.body, {
        status: adminCheck.error.status,
        headers: corsHeaders,
      });
    }

    const priceMap = parseServicePriceIds();
    const servicesToEnable = enabledServices.filter((service) =>
      ALL_SERVICES.includes(service)
    );

    if (servicesToEnable.length === 0) {
      return new Response(JSON.stringify({ error: "Select at least one service" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const missingPrice = servicesToEnable.find((service) => !priceMap[service]);
    if (missingPrice) {
      return new Response(
        JSON.stringify({ error: `Missing price for ${missingPrice}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    for (const service of servicesToEnable) {
      const priceId = priceMap[service];
      const price = await stripe.prices.retrieve(priceId);
      const isMonthly = price.recurring?.interval === "month";
      const isExpectedAmount = price.unit_amount === 2500;
      if (!isMonthly || !isExpectedAmount) {
        return new Response(
          JSON.stringify({
            error:
              `Price for ${service} must be a monthly recurring price set to $25.00`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const { data: billingRow } = await supabaseAdmin
      .from("billing_customers")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    let customerId = billingRow?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: authCheck.user.email ?? undefined,
        metadata: { workspace_id: workspaceId },
      });
      customerId = customer.id;
      await supabaseAdmin.from("billing_customers").upsert({
        workspace_id: workspaceId,
        stripe_customer_id: customerId,
      });
    }

    const lineItems = servicesToEnable.map((service) => ({
      price: priceMap[service],
      quantity: 1,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: lineItems,
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          workspace_id: workspaceId,
          enabled_services: servicesToEnable.join(","),
        },
      },
      metadata: {
        workspace_id: workspaceId,
        enabled_services: servicesToEnable.join(","),
      },
    });

    const serviceRows = ALL_SERVICES.map((service) => ({
      workspace_id: workspaceId,
      service,
      enabled: servicesToEnable.includes(service),
    }));
    await supabaseAdmin.from("billing_services").upsert(serviceRows, {
      onConflict: "workspace_id,service",
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Create checkout session error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
