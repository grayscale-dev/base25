describe("app-params", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    window.history.replaceState({}, "", "/auth/callback");
  });

  test("reads params from URL and stores normalized token values", async () => {
    localStorage.setItem("token", "legacy-token");
    window.history.replaceState(
      {},
      "",
      "/auth/callback?access_token=fresh-token&app_id=app-123&functions_version=v2&app_base_url=https://app.base25.dev#from_url=%2Fworkspace%2Facme"
    );

    const { appParams } = await import("@/lib/app-params");

    expect(appParams.token).toBe("fresh-token");
    expect(appParams.appId).toBe("app-123");
    expect(appParams.functionsVersion).toBe("v2");
    expect(appParams.appBaseUrl).toBe("https://app.base25.dev");
    expect(appParams.fromUrl).toBe("/workspace/acme");
    expect(localStorage.getItem("base44_access_token")).toBe("fresh-token");
    expect(window.location.search).not.toContain("access_token=");
  });

  test("falls back to legacy token when access token query is absent", async () => {
    localStorage.setItem("token", "legacy-token");
    window.history.replaceState({}, "", "/auth/callback");

    const { appParams } = await import("@/lib/app-params");

    expect(localStorage.getItem("base44_access_token")).toBe("legacy-token");
    expect(appParams.token).toBe("legacy-token");
  });

  test("clear_access_token removes stored auth tokens", async () => {
    localStorage.setItem("token", "legacy-token");
    localStorage.setItem("base44_access_token", "old-token");
    window.history.replaceState({}, "", "/auth/callback?clear_access_token=true");

    const { appParams } = await import("@/lib/app-params");

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("base44_access_token")).toBeNull();
    expect(appParams.token).toBeNull();
  });

  test("uses defaults when query values are absent", async () => {
    window.history.replaceState({}, "", "/auth/callback");

    const { appParams } = await import("@/lib/app-params");

    expect(appParams.fromUrl).toContain("/auth/callback");
    expect(appParams.appId).toBeDefined();
    expect(appParams.functionsVersion).toBeDefined();
    expect(appParams.appBaseUrl).toBeDefined();
  });
});
