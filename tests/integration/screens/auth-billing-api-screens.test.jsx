import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  replace,
  refresh,
  getSearchParam,
  signInWithOtp,
  getSession,
  exchangeCodeForSession,
  verifyOtp,
  navigate,
  getWorkspaceSession,
  setWorkspaceSettingsTabIntent,
  openStripeBilling,
} = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  getSearchParam: vi.fn(),
  signInWithOtp: vi.fn(),
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  navigate: vi.fn(),
  getWorkspaceSession: vi.fn(),
  setWorkspaceSettingsTabIntent: vi.fn(),
  openStripeBilling: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => ({ get: (key) => getSearchParam(key) }),
}));

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    auth: {
      signInWithOtp,
      getSession,
      exchangeCodeForSession,
      verifyOtp,
    },
  },
}));

vi.mock("@/lib/router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/lib/workspace-session", () => ({
  getWorkspaceSession,
  setWorkspaceSettingsTabIntent,
}));

vi.mock("@/lib/openStripeBilling", () => ({
  openStripeBilling,
}));

import AuthSignIn from "@/screens/AuthSignIn";
import AuthCallback from "@/screens/AuthCallback";
import Billing from "@/screens/Billing";
import ApiDocs from "@/screens/ApiDocs";

describe("AuthSignIn", () => {
  beforeEach(() => {
    vi.useRealTimers();
    replace.mockReset();
    refresh.mockReset();
    getSearchParam.mockReset();
    signInWithOtp.mockReset();
    getSession.mockReset();

    getSearchParam.mockImplementation((key) => (key === "returnTo" ? "/workspace/acme/feedback" : null));
    getSession.mockResolvedValue({ data: { session: null } });
    signInWithOtp.mockResolvedValue({ error: null });
  });

  test("validates empty email and sends magic link", async () => {
    render(<AuthSignIn />);

    fireEvent.click(screen.getByRole("button", { name: /send magic link/i }));
    expect(screen.getByText(/Enter your email to continue/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ADMIN@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "admin@example.com",
        })
      );
    });

    expect(screen.getByText(/Magic link sent to/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend in/i })).toBeDisabled();
  });

  test("redirects immediately when session already exists", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    render(<AuthSignIn />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/workspace/acme/feedback");
      expect(refresh).toHaveBeenCalled();
    });
  });
});

describe("AuthCallback", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    getSearchParam.mockReset();
    getSession.mockReset();
    exchangeCodeForSession.mockReset();
    verifyOtp.mockReset();

    getSearchParam.mockImplementation((key) => {
      if (key === "returnTo") return "/workspaces";
      if (key === "code") return "auth-code";
      return null;
    });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null });
  });

  test("exchanges code and redirects on success", async () => {
    render(<AuthCallback />);

    await waitFor(() => {
      expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
      expect(replace).toHaveBeenCalledWith("/workspaces");
      expect(refresh).toHaveBeenCalled();
    });
  });

  test("shows actionable error when callback fails", async () => {
    exchangeCodeForSession.mockRejectedValue(new Error("expired"));
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(<AuthCallback />);

    expect(await screen.findByText(/sign-in failed/i, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request a new magic link/i })).toHaveAttribute(
      "href",
      "/auth/sign-in?returnTo=%2Fworkspaces"
    );
  });
});

describe("Billing and ApiDocs screens", () => {
  beforeEach(() => {
    navigate.mockReset();
    getWorkspaceSession.mockReset();
    setWorkspaceSettingsTabIntent.mockReset();
    openStripeBilling.mockReset();
  });

  test("Billing redirects when no workspace exists in session", async () => {
    getWorkspaceSession.mockReturnValue({ workspace: null, role: "owner" });
    render(<Billing />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/workspaces", { replace: true });
    });
  });

  test("Billing redirects non-owner users back to workspace", async () => {
    getWorkspaceSession.mockReturnValue({
      workspace: { id: "w1", slug: "acme" },
      role: "admin",
    });
    render(<Billing />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/workspace/acme/all", { replace: true });
    });
  });

  test("Billing shows error state when Stripe open fails", async () => {
    getWorkspaceSession.mockReturnValue({
      workspace: { id: "w1", slug: "acme" },
      role: "owner",
    });
    openStripeBilling.mockResolvedValue({ ok: false, error: "Stripe unavailable" });

    render(<Billing />);

    expect(await screen.findByText("Billing unavailable")).toBeInTheDocument();
    expect(screen.getByText("Stripe unavailable")).toBeInTheDocument();
  });

  test("ApiDocs routes users based on role and workspace", async () => {
    getWorkspaceSession.mockReturnValueOnce({ workspace: null, role: "owner" });
    const { unmount } = render(<ApiDocs />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/workspaces", { replace: true });
    });

    unmount();
    navigate.mockClear();
    getWorkspaceSession.mockReturnValueOnce({ workspace: { slug: "acme" }, role: "contributor" });
    const second = render(<ApiDocs />);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/workspace/acme/feedback", { replace: true });
    });

    second.unmount();
    navigate.mockClear();
    getWorkspaceSession.mockReturnValueOnce({ workspace: { slug: "acme" }, role: "owner" });
    render(<ApiDocs />);
    await waitFor(() => {
      expect(setWorkspaceSettingsTabIntent).toHaveBeenCalledWith("api");
      expect(navigate).toHaveBeenCalledWith("/workspace-settings", { replace: true });
    });
  });
});
