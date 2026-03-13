import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

const {
  me,
  invoke,
  getWorkspaceSession,
  setWorkspaceSession,
  getOrCreateAnalyticsSessionId,
  fetchWorkspaceBootstrapCached,
} = vi.hoisted(() => ({
  me: vi.fn(),
  invoke: vi.fn(),
  getWorkspaceSession: vi.fn(),
  setWorkspaceSession: vi.fn(),
  getOrCreateAnalyticsSessionId: vi.fn(),
  fetchWorkspaceBootstrapCached: vi.fn(),
}));

vi.mock("@/api/base44Client", () => ({
  base44: {
    auth: { me },
    functions: { invoke },
  },
}));

vi.mock("@/lib/workspace-session", () => ({
  getWorkspaceSession,
  setWorkspaceSession,
  getOrCreateAnalyticsSessionId,
}));

vi.mock("@/lib/workspace-queries", () => ({
  fetchWorkspaceBootstrapCached,
}));

import { WorkspaceProvider, useWorkspaceContext } from "@/components/context/WorkspaceContext";

function Probe() {
  const ctx = useWorkspaceContext();
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="role">{ctx.role}</span>
      <span data-testid="workspace">{ctx.workspace?.slug || "none"}</span>
      <span data-testid="can-manage">{String(ctx.permissions.canManageSettings)}</span>
      <span data-testid="login-prompt">{ctx.messages.loginPrompt || "none"}</span>
    </div>
  );
}

describe("WorkspaceProvider", () => {
  beforeEach(() => {
    me.mockReset();
    invoke.mockReset();
    getWorkspaceSession.mockReset();
    setWorkspaceSession.mockReset();
    getOrCreateAnalyticsSessionId.mockReset();
    fetchWorkspaceBootstrapCached.mockReset();

    getWorkspaceSession.mockReturnValue({ workspace: null, role: "contributor", isPublicAccess: false });
    me.mockResolvedValue({ id: "u1", email: "owner@example.com" });
    invoke.mockResolvedValue({ data: {} });
    getOrCreateAnalyticsSessionId.mockReturnValue("session-1");
  });

  test("marks loading false when route has no workspace slug", async () => {
    window.history.replaceState({}, "", "/workspaces");

    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("workspace")).toHaveTextContent("none");
    });
  });

  test("uses session workspace and computes admin permissions", async () => {
    window.history.replaceState({}, "", "/workspace/acme/feedback");
    getWorkspaceSession.mockReturnValue({
      workspace: { id: "w1", slug: "acme", name: "Acme", billing_access_allowed: true },
      role: "owner",
      isPublicAccess: false,
    });

    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("workspace")).toHaveTextContent("acme");
      expect(screen.getByTestId("role")).toHaveTextContent("owner");
      expect(screen.getByTestId("can-manage")).toHaveTextContent("true");
    });

    expect(invoke).toHaveBeenCalledWith(
      "publicTrackWorkspaceView",
      expect.objectContaining({ slug: "acme", session_id: "session-1" })
    );
  });

  test("bootstraps workspace from API when session is missing", async () => {
    window.history.replaceState({}, "", "/workspace/acme/feedback");
    getWorkspaceSession.mockReturnValue({ workspace: null, role: "contributor", isPublicAccess: false });
    fetchWorkspaceBootstrapCached.mockResolvedValue({
      id: "w1",
      slug: "acme",
      name: "Acme",
      role: "admin",
      is_public_access: false,
      primary_color: "#004cff",
      billing_access_allowed: true,
    });

    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    );

    await waitFor(() => {
      expect(fetchWorkspaceBootstrapCached).toHaveBeenCalledWith({ slug: "acme", includeItems: false });
      expect(setWorkspaceSession).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace: expect.objectContaining({ slug: "acme" }),
          role: "admin",
        })
      );
      expect(screen.getByTestId("role")).toHaveTextContent("admin");
    });
  });

  test("sets login prompt for public-access unauthenticated users", async () => {
    window.history.replaceState({}, "", "/workspace/public-team/feedback");
    getWorkspaceSession.mockReturnValue({
      workspace: { id: "w2", slug: "public-team", name: "Public Team" },
      role: "contributor",
      isPublicAccess: true,
    });
    me.mockRejectedValue(new Error("unauthenticated"));

    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("login-prompt")).toHaveTextContent(/Login to contribute/i);
    });
  });
});
