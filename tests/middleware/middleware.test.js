import { NextResponse } from "next/server";

const { getUser, withSupabaseCookies } = vi.hoisted(() => ({
  getUser: vi.fn(),
  withSupabaseCookies: vi.fn((target) => target),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  createSupabaseMiddlewareClient: vi.fn(() => ({
    supabase: {
      auth: {
        getUser,
      },
    },
    response: NextResponse.next(),
  })),
  withSupabaseCookies,
}));

import {
  middleware,
  canonicalStaticPaths,
  isStaticAsset,
  getCanonicalPath,
  sanitizeReturnTo,
} from "@/middleware";

function makeRequest(url) {
  const parsed = new URL(url);
  const nextUrl = {
    pathname: parsed.pathname,
    search: parsed.search,
    searchParams: parsed.searchParams,
    clone: () => new URL(parsed.toString()),
  };

  return {
    nextUrl,
    headers: new Headers(),
    cookies: {
      getAll: () => [],
      set: vi.fn(),
    },
  };
}

describe("middleware helpers", () => {
  test("exports canonical aliases", () => {
    expect(canonicalStaticPaths["/home"]).toBe("/");
    expect(canonicalStaticPaths["/joinworkspace"]).toBe("/join-workspace");
  });

  test("isStaticAsset detects next assets and extension files", () => {
    expect(isStaticAsset("/_next/static/chunk.js")).toBe(true);
    expect(isStaticAsset("/favicon.ico")).toBe(true);
    expect(isStaticAsset("/image.png")).toBe(true);
    expect(isStaticAsset("/workspace/acme/feedback")).toBe(false);
  });

  test("canonical path handles aliases and workspace defaults", () => {
    expect(getCanonicalPath("/Home")).toBe("/");
    expect(getCanonicalPath("/joinworkspace")).toBe("/join-workspace");
    expect(getCanonicalPath("/workspace/AcMe")).toBe("/workspace/acme/feedback");
    expect(getCanonicalPath("/workspace/AcMe/All")).toBe("/workspace/acme/all");
    expect(getCanonicalPath("/about/")).toBe("/about");
  });

  test("sanitizeReturnTo blocks invalid auth paths", () => {
    expect(sanitizeReturnTo("/workspace/acme/feedback")).toBe("/workspace/acme/feedback");
    expect(sanitizeReturnTo("https://evil.com")).toBeNull();
    expect(sanitizeReturnTo("//evil.com")).toBeNull();
    expect(sanitizeReturnTo("/auth/sign-in")).toBeNull();
    expect(sanitizeReturnTo("/auth/callback")).toBeNull();
  });
});

describe("middleware route behavior", () => {
  beforeEach(() => {
    getUser.mockReset();
    withSupabaseCookies.mockClear();
  });

  test("redirects to canonical path when needed", async () => {
    const response = await middleware(makeRequest("https://base25.app/Home"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://base25.app/");
  });

  test("preserves query string when redirecting aliases", async () => {
    const response = await middleware(
      makeRequest("https://base25.app/joinworkspace?code=ABC123")
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://base25.app/join-workspace?code=ABC123"
    );
  });

  test("normalizes workspace slug root route to lowercase feedback path", async () => {
    const response = await middleware(
      makeRequest("https://base25.app/workspace/AcMe?tab=all")
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://base25.app/workspace/acme/feedback?tab=all"
    );
  });

  test("normalizes trailing slashes", async () => {
    const response = await middleware(makeRequest("https://base25.app/pricing/"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://base25.app/pricing");
  });

  test("redirects unauthenticated protected routes to sign-in with returnTo", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const response = await middleware(makeRequest("https://base25.app/workspaces?tab=mine"));

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/auth/sign-in");
    expect(decodeURIComponent(location)).toContain("returnTo=/workspaces?tab=mine");
    expect(withSupabaseCookies).toHaveBeenCalled();
  });

  test("allows unauthenticated public routes", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const response = await middleware(makeRequest("https://base25.app/pricing"));

    expect(response.status).toBe(200);
  });

  test("redirects authenticated users away from sign-in", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const response = await middleware(
      makeRequest("https://base25.app/auth/sign-in?returnTo=/workspace/acme/feedback")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://base25.app/workspace/acme/feedback");
  });

  test("redirects authenticated users from sign-in to workspaces when returnTo invalid", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const response = await middleware(
      makeRequest("https://base25.app/auth/sign-in?returnTo=/auth/sign-in")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://base25.app/workspaces");
  });
});
