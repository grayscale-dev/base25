import { act, renderHook, waitFor } from "@testing-library/react";

const { push, replace, usePathnameMock, useParamsMock } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  usePathnameMock: vi.fn(),
  useParamsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => usePathnameMock(),
  useParams: () => useParamsMock(),
}));

import { useLocation, useNavigate, useParams } from "@/lib/router";
import { startWorkspaceLogin } from "@/lib/start-workspace-login";

describe("router hooks", () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    usePathnameMock.mockReset();
    useParamsMock.mockReset();
    usePathnameMock.mockReturnValue("/workspace/acme/feedback");
    useParamsMock.mockReturnValue({ slug: "acme" });
    window.__base25LocationPatched = false;
    window.history.replaceState({}, "", "/workspace/acme/feedback?tab=1#comments");
  });

  test("useNavigate supports push, replace, and numeric history", () => {
    const historyGo = vi.spyOn(window.history, "go");
    const { result } = renderHook(() => useNavigate());

    act(() => {
      result.current("/pricing");
      result.current({ pathname: "/search", search: "?q=bug", hash: "#top" }, { replace: true });
      result.current(-1);
    });

    expect(push).toHaveBeenCalledWith("/pricing");
    expect(replace).toHaveBeenCalledWith("/search?q=bug#top");
    expect(historyGo).toHaveBeenCalledWith(-1);
  });

  test("useLocation tracks search/hash changes via history patch", async () => {
    const { result } = renderHook(() => useLocation());

    expect(result.current.pathname).toBe("/workspace/acme/feedback");
    expect(result.current.search).toBe("?tab=1");
    expect(result.current.hash).toBe("#comments");

    act(() => {
      window.history.pushState({}, "", "/workspace/acme/feedback?tab=2#activity");
    });

    await waitFor(() => {
      expect(result.current.search).toBe("?tab=2");
      expect(result.current.hash).toBe("#activity");
    });
  });

  test("useParams proxies next/navigation params", () => {
    const { result } = renderHook(() => useParams());
    expect(result.current).toEqual({ slug: "acme" });
  });
});

describe("startWorkspaceLogin", () => {
  test("redirects to sign-in with sanitized returnTo", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://base25.app/features?ref=ad",
        origin: "https://base25.app",
        assign,
      },
    });

    const result = await startWorkspaceLogin({
      redirectTo: "https://base25.app/workspace/acme/feedback?view=all",
    });

    expect(result).toEqual({ ok: true });
    expect(assign).toHaveBeenCalledTimes(1);
    const target = new URL(assign.mock.calls[0][0]);
    expect(target.pathname).toBe("/auth/sign-in");
    expect(target.searchParams.get("returnTo")).toBe("/workspace/acme/feedback?view=all");
  });
});
