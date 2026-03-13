import {
  RATE_LIMITS,
  addCacheHeaders,
  addNoCacheHeaders,
  applyRateLimit,
} from "../_shared/rateLimiter.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";

const requestWithIp = (ip: string) =>
  new Request("https://example.com/functions", {
    headers: {
      "x-forwarded-for": ip,
    },
  });

Deno.test("rateLimiter allows requests under threshold", async () => {
  const response = await applyRateLimit(requestWithIp("172.31.0.1"), RATE_LIMITS.PUBLIC_API);
  assertEquals(response, null);
});

Deno.test("rateLimiter cache header helpers set expected values", () => {
  const base = new Response("ok", { status: 200 });
  const cached = addCacheHeaders(base, 60);
  assertEquals(cached.headers.get("Vary"), "Accept-Encoding");
  assertEquals(cached.headers.get("Cache-Control")?.includes("max-age=60"), true);

  const noCache = addNoCacheHeaders(base);
  assertEquals(noCache.headers.get("Pragma"), "no-cache");
  assertEquals(noCache.headers.get("Cache-Control")?.includes("no-store"), true);
});
