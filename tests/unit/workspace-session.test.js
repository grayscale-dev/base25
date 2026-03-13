import {
  getWorkspaceSession,
  setWorkspaceSession,
  clearWorkspaceSession,
  setWorkspaceSettingsTabIntent,
  consumeWorkspaceSettingsTabIntent,
  getOrCreateAnalyticsSessionId,
} from "@/lib/workspace-session";

describe("workspace session utilities", () => {
  test("reads defaults when empty", () => {
    sessionStorage.clear();
    expect(getWorkspaceSession()).toEqual({
      workspace: null,
      workspaceId: null,
      role: "contributor",
      isPublicAccess: false,
      billingBlocked: false,
    });
  });

  test("set and clear workspace session values", () => {
    const listener = vi.fn();
    window.addEventListener("workspace-session-updated", listener);

    setWorkspaceSession({
      workspace: { id: "w1", slug: "acme" },
      role: "admin",
      isPublicAccess: true,
      billingBlocked: true,
    });

    expect(getWorkspaceSession()).toEqual({
      workspace: { id: "w1", slug: "acme" },
      workspaceId: "w1",
      role: "admin",
      isPublicAccess: true,
      billingBlocked: true,
    });
    expect(listener).toHaveBeenCalled();

    clearWorkspaceSession();
    expect(getWorkspaceSession().workspace).toBeNull();

    window.removeEventListener("workspace-session-updated", listener);
  });

  test("settings tab intent consume is one-shot", () => {
    setWorkspaceSettingsTabIntent("access");
    expect(consumeWorkspaceSettingsTabIntent()).toBe("access");
    expect(consumeWorkspaceSettingsTabIntent()).toBeNull();
  });

  test("analytics session id is stable once set", () => {
    const first = getOrCreateAnalyticsSessionId();
    const second = getOrCreateAnalyticsSessionId();
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });
});
