import {
  RATE_LIMITS,
  addCacheHeaders,
  addNoCacheHeaders,
  applyRateLimit,
} from "../../supabase/functions/_shared/rateLimiter.ts";

function makeRequest(ip = "127.0.0.1") {
  return new Request("https://example.com/functions", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("edge shared rate limiter", () => {
  test("allows requests under limits", async () => {
    const response = await applyRateLimit(makeRequest("10.0.0.1"), RATE_LIMITS.PUBLIC_API);
    expect(response).toBeNull();
  });

  test("blocks burst traffic with 429 response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T12:00:00.000Z"));
    const ip = "10.0.0.2";

    let blocked = null;
    for (let index = 0; index <= RATE_LIMITS.PUBLIC_API.burst; index += 1) {
      // Requests are inside a 10s burst window; final one should be blocked.
      // eslint-disable-next-line no-await-in-loop
      blocked = await applyRateLimit(makeRequest(ip), RATE_LIMITS.PUBLIC_API);
    }

    expect(blocked).toBeInstanceOf(Response);
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(body.error).toMatch(/burst/i);
  });

  test("applies session-level analytics limit", async () => {
    const config = RATE_LIMITS.ANALYTICS;
    const options = { sessionId: "session-1", identifier: "item-1" };

    expect(await applyRateLimit(makeRequest("10.0.0.3"), config, options)).toBeNull();

    // Different IP keeps IP bucket from blocking first; session key should trigger.
    const blocked = await applyRateLimit(makeRequest("10.0.0.4"), config, options);
    expect(blocked).toBeInstanceOf(Response);
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.code).toBe("SESSION_LIMIT_EXCEEDED");
  });

  test("cache helper wrappers set expected headers", () => {
    const base = new Response("ok", { status: 200 });
    const cached = addCacheHeaders(base, 30);
    expect(cached.headers.get("Cache-Control")).toContain("max-age=30");
    expect(cached.headers.get("Vary")).toBe("Accept-Encoding");

    const noCache = addNoCacheHeaders(base);
    expect(noCache.headers.get("Cache-Control")).toContain("no-store");
    expect(noCache.headers.get("Pragma")).toBe("no-cache");
  });
});
