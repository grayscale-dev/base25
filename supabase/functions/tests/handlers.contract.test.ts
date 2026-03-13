import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { spy } from "https://deno.land/std@0.224.0/testing/mock.ts";

type EdgeHandler = (req: Request) => Response | Promise<Response>;

const BASE_ENV: Record<string, string> = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

async function loadHandler(
  relativeModulePath: string,
  envOverrides: Record<string, string | undefined> = {},
): Promise<EdgeHandler> {
  const priorEnv = new Map<string, string | undefined>();
  const mergedEnv: Record<string, string | undefined> = {
    ...BASE_ENV,
    ...envOverrides,
  };

  Object.entries(mergedEnv).forEach(([key, value]) => {
    priorEnv.set(key, Deno.env.get(key));
    if (typeof value === "undefined") {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  });

  const serveSpy = spy(Deno, "serve");

  try {
    const moduleUrl = new URL(
      `${relativeModulePath}?test=${crypto.randomUUID()}`,
      import.meta.url,
    );
    await import(moduleUrl.href);

    const captured = serveSpy.calls.at(-1)?.args?.[0] as EdgeHandler | undefined;
    assert(captured, `Expected Deno.serve handler to be captured for ${relativeModulePath}`);
    return captured;
  } finally {
    serveSpy.restore();
    priorEnv.forEach((value, key) => {
      if (typeof value === "undefined") {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    });
  }
}

async function parseJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

Deno.test("createCheckoutSession handles OPTIONS and missing Stripe config", async () => {
  const handler = await loadHandler("../createCheckoutSession/index.ts", {
    STRIPE_SECRET_KEY: undefined,
    STRIPE_PRICE_FLAT_MONTHLY_ID: undefined,
  });

  const options = await handler(new Request("https://example.com", { method: "OPTIONS" }));
  assertEquals(options.status, 200);
  assertEquals(options.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");

  const response = await handler(
    new Request("https://example.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace_id: "ws-1" }),
    }),
  );
  assertEquals(response.status, 500);
  const body = await parseJson(response);
  assertEquals(body.error, "Stripe is not configured");
});

Deno.test("createBillingPortal returns clear error when Stripe is not configured", async () => {
  const handler = await loadHandler("../createBillingPortal/index.ts", {
    STRIPE_SECRET_KEY: undefined,
  });

  const response = await handler(
    new Request("https://example.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace_id: "ws-1", return_url: "https://example.com" }),
    }),
  );

  assertEquals(response.status, 500);
  const body = await parseJson(response);
  assertEquals(body.error, "Stripe not configured");
});

Deno.test("refreshWorkspaceBillingStatus returns missing-config error without Stripe", async () => {
  const handler = await loadHandler("../refreshWorkspaceBillingStatus/index.ts", {
    STRIPE_SECRET_KEY: undefined,
  });

  const response = await handler(
    new Request("https://example.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace_id: "ws-1" }),
    }),
  );

  assertEquals(response.status, 500);
  const body = await parseJson(response);
  assertEquals(body.error, "Stripe is not configured");
});

Deno.test("stripeWebhook returns missing-config error when webhook secrets are absent", async () => {
  const handler = await loadHandler("../stripeWebhook/index.ts", {
    STRIPE_SECRET_KEY: undefined,
    STRIPE_WEBHOOK_SECRET: undefined,
  });

  const response = await handler(
    new Request("https://example.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );

  assertEquals(response.status, 500);
  const body = await parseJson(response);
  assertEquals(body.error, "Stripe not configured");
});

Deno.test("listMyWorkspaces requires authentication", async () => {
  const handler = await loadHandler("../listMyWorkspaces/index.ts");

  const options = await handler(new Request("https://example.com", { method: "OPTIONS" }));
  assertEquals(options.status, 200);

  const response = await handler(
    new Request("https://example.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );

  assertEquals(response.status, 401);
  const body = await parseJson(response);
  assertEquals(body.code, "UNAUTHORIZED");
  assertStringIncludes(String(body.reason || ""), "missing");
});

Deno.test("alerts endpoints validate workspace payload before data fetch", async () => {
  const listAlertsHandler = await loadHandler("../listAlerts/index.ts");
  const unreadCountHandler = await loadHandler("../getUnreadAlertCount/index.ts");

  const badPayloadRequest = new Request("https://example.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  const listAlertsResponse = await listAlertsHandler(badPayloadRequest);
  assertEquals(listAlertsResponse.status, 400);
  const listAlertsBody = await parseJson(listAlertsResponse);
  assertStringIncludes(String(listAlertsBody.error || ""), "workspace_id or slug");

  const unreadCountResponse = await unreadCountHandler(
    new Request("https://example.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
  assertEquals(unreadCountResponse.status, 400);
  const unreadCountBody = await parseJson(unreadCountResponse);
  assertStringIncludes(String(unreadCountBody.error || ""), "workspace_id or slug");
});
