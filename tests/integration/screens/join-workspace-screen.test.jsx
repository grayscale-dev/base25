import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  navigate,
  setWorkspaceSession,
  me,
  redirectToLogin,
  ensureWorkspaceMembership,
  getWorkspaceRole,
  joinWorkspaceWithCode,
  resolveWorkspaceJoinCandidate,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  setWorkspaceSession: vi.fn(),
  me: vi.fn(),
  redirectToLogin: vi.fn(),
  ensureWorkspaceMembership: vi.fn(),
  getWorkspaceRole: vi.fn(),
  joinWorkspaceWithCode: vi.fn(),
  resolveWorkspaceJoinCandidate: vi.fn(),
}));

vi.mock("@/lib/router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/api/base44Client", () => ({
  base44: {
    auth: {
      me,
      redirectToLogin,
    },
  },
}));

vi.mock("@/lib/workspace-session", () => ({
  setWorkspaceSession,
}));

vi.mock("@/lib/workspace-join", () => ({
  ensureWorkspaceMembership,
  getWorkspaceRole,
  joinWorkspaceWithCode,
  resolveWorkspaceJoinCandidate,
}));

import JoinWorkspace from "@/screens/JoinWorkspace";

describe("JoinWorkspace screen", () => {
  beforeEach(() => {
    navigate.mockReset();
    setWorkspaceSession.mockReset();
    me.mockReset();
    redirectToLogin.mockReset();
    ensureWorkspaceMembership.mockReset();
    getWorkspaceRole.mockReset();
    joinWorkspaceWithCode.mockReset();
    resolveWorkspaceJoinCandidate.mockReset();

    me.mockResolvedValue({ id: "user-1", email: "member@example.com" });
    getWorkspaceRole.mockResolvedValue(null);
  });

  test("shows invalid-link state when workspace query param is missing", async () => {
    window.history.pushState({}, "", "/join-workspace");

    render(<JoinWorkspace />);

    expect(await screen.findByText("Unable to Join")).toBeInTheDocument();
    expect(screen.getByText("Invalid join link - no workspace specified.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Workspaces" }));
    expect(navigate).toHaveBeenCalledWith("/workspaces");
  });

  test("redirects to auth when user is not logged in", async () => {
    window.history.pushState({}, "", "/join-workspace?workspace=acme");
    me.mockRejectedValueOnce(new Error("not authenticated"));

    render(<JoinWorkspace />);

    await waitFor(() => {
      expect(redirectToLogin).toHaveBeenCalled();
    });
  });

  test("joins immediately when invite does not require access code", async () => {
    window.history.pushState({}, "", "/join-workspace?workspace=acme");
    resolveWorkspaceJoinCandidate.mockResolvedValueOnce({
      status: "ok",
      workspace: { id: "ws-1", slug: "acme", name: "Acme" },
    });
    ensureWorkspaceMembership.mockResolvedValueOnce({ role: "contributor" });

    render(<JoinWorkspace />);

    expect(await screen.findByRole("heading", { name: "Join Workspace" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Join Workspace" }));

    await waitFor(() => {
      expect(ensureWorkspaceMembership).toHaveBeenCalledWith({
        workspace: { id: "ws-1", slug: "acme", name: "Acme" },
        user: { id: "user-1", email: "member@example.com" },
      });
    });

    expect(setWorkspaceSession).toHaveBeenCalledWith({
      workspace: { id: "ws-1", slug: "acme", name: "Acme" },
      role: "contributor",
    });
    expect(navigate).toHaveBeenCalledWith("/workspace/acme/feedback");
  });

  test("supports restricted workspace join with access code", async () => {
    window.history.pushState({}, "", "/join-workspace?workspace=acme");
    resolveWorkspaceJoinCandidate.mockResolvedValueOnce({ status: "requires_code" });
    joinWorkspaceWithCode.mockResolvedValueOnce({
      workspace: { id: "ws-1", slug: "acme", name: "Acme" },
      role: "contributor",
    });

    render(<JoinWorkspace />);

    expect(await screen.findByRole("heading", { name: "Enter Access Code" })).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Access code");
    fireEvent.change(input, { target: { value: "acmecode" } });

    fireEvent.click(screen.getAllByRole("button", { name: "Join Workspace" }).at(-1));

    await waitFor(() => {
      expect(joinWorkspaceWithCode).toHaveBeenCalledWith({ slug: "acme", accessCode: "ACMECODE" });
    });

    expect(setWorkspaceSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({ slug: "acme" }),
        role: "contributor",
      })
    );
    expect(navigate).toHaveBeenCalledWith("/workspace/acme/feedback");
  });

  test("shows already-member state and opens workspace", async () => {
    window.history.pushState({}, "", "/join-workspace?workspace=acme");
    resolveWorkspaceJoinCandidate.mockResolvedValueOnce({
      status: "ok",
      workspace: { id: "ws-1", slug: "acme", name: "Acme" },
    });
    getWorkspaceRole.mockResolvedValueOnce({ role: "admin" });

    render(<JoinWorkspace />);

    expect(await screen.findByText("Already a Member")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Workspace" }));

    expect(setWorkspaceSession).toHaveBeenCalledWith({
      workspace: { id: "ws-1", slug: "acme", name: "Acme" },
      role: "admin",
    });
    expect(navigate).toHaveBeenCalledWith("/workspace/acme/all");
  });

  test("shows access-code error state on invalid code", async () => {
    window.history.pushState({}, "", "/join-workspace?workspace=acme");
    resolveWorkspaceJoinCandidate.mockResolvedValueOnce({ status: "requires_code" });
    joinWorkspaceWithCode.mockRejectedValueOnce({ status: 403 });

    render(<JoinWorkspace />);

    expect(await screen.findByRole("heading", { name: "Enter Access Code" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Access code"), { target: { value: "WRONG" } });
    fireEvent.click(screen.getByRole("button", { name: "Join Workspace" }));

    expect(await screen.findByText("Invalid or expired access code.")).toBeInTheDocument();
  });
});
