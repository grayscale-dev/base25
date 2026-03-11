import Stripe from "https://esm.sh/stripe@14.20.0?target=deno";
import { requireAuth, requireOwner, verifyWorkspace } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const flatMonthlyPriceId = Deno.env.get("STRIPE_PRICE_FLAT_MONTHLY_ID") ?? "";
const legacyServicePriceIdsRaw = Deno.env.get("STRIPE_PRICE_SERVICE_IDS") ?? "{}";
const FLAT_MONTHLY_PRICE_CENTS = 3000;

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseLegacyServicePriceIds() {
  try {
    const parsed = JSON.parse(legacyServicePriceIdsRaw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string>;
    }
  } catch {
    // fallthrough
  }

  const mapping: Record<string, string> = {};
  legacyServicePriceIdsRaw.split(",").forEach((pair) => {
    const [service, priceId] = pair.split(":").map((value) => value.trim());
    if (service && priceId) {
      mapping[service] = priceId;
    }
  });
  return mapping;
}

function resolveFlatPriceId() {
  if (flatMonthlyPriceId) {
    return flatMonthlyPriceId;
  }
  const legacyMap = parseLegacyServicePriceIds();
  const firstLegacyPrice = Object.values(legacyMap).find(Boolean);
  return firstLegacyPrice || "";
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
    // Legacy compatibility: tolerate service-based fields but ignore them for flat pricing.
    const enabledServices: string[] = Array.isArray(payload.enabled_services) ? payload.enabled_services : [];
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

    const ownerCheck = await requireOwner(workspaceId, authCheck.user.id);
    if (!ownerCheck.success) {
      return new Response(ownerCheck.error.body, {
        status: ownerCheck.error.status,
        headers: corsHeaders,
      });
    }

    const priceId = resolveFlatPriceId();
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: "STRIPE_PRICE_FLAT_MONTHLY_ID is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let price: Stripe.Price;
    try {
      price = await stripe.prices.retrieve(priceId);
    } catch (stripePriceError) {
      const detail = stripePriceError instanceof Error ? stripePriceError.message : String(stripePriceError || "");
      return new Response(
        JSON.stringify({
          error: "Failed to retrieve Stripe price. Verify STRIPE_SECRET_KEY and STRIPE_PRICE_FLAT_MONTHLY_ID belong to the same Stripe mode/account.",
          detail,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const isMonthly = price.recurring?.interval === "month";
    const isExpectedAmount = price.unit_amount === FLAT_MONTHLY_PRICE_CENTS;
    if (!isMonthly || !isExpectedAmount) {
      return new Response(
        JSON.stringify({
          error: "Configured flat monthly Stripe price must be a monthly recurring $30.00 price.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          workspace_id: workspaceId,
          billing_model: "flat_monthly",
        },
      },
      metadata: {
        workspace_id: workspaceId,
        billing_model: "flat_monthly",
        // Keep legacy metadata shape populated to simplify transition consumers.
        enabled_services: enabledServices.join(","),
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Create checkout session error:", error);
    const detail = error instanceof Error ? error.message : String(error || "");
    return new Response(JSON.stringify({ error: "Internal server error", detail }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
