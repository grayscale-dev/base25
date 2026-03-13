import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const {
  navigate,
  setWorkspaceSession,
  fetchListMyWorkspacesCached,
  ensureWorkspaceMembership,
  joinWorkspaceWithCode,
  parseWorkspaceSlug,
  resolveWorkspaceJoinCandidate,
  base44,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  setWorkspaceSession: vi.fn(),
  fetchListMyWorkspacesCached: vi.fn(),
  ensureWorkspaceMembership: vi.fn(),
  joinWorkspaceWithCode: vi.fn(),
  parseWorkspaceSlug: vi.fn(),
  resolveWorkspaceJoinCandidate: vi.fn(),
  base44: {
    auth: {
      me: vi.fn(),
      redirectToLogin: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/lib/router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/api/base44Client", () => ({ base44 }));
vi.mock("@/lib/workspace-session", () => ({ setWorkspaceSession }));
vi.mock("@/lib/workspace-queries", () => ({ fetchListMyWorkspacesCached }));
vi.mock("@/lib/workspace-join", () => ({
  ensureWorkspaceMembership,
  joinWorkspaceWithCode,
  parseWorkspaceSlug,
  resolveWorkspaceJoinCandidate,
}));

vi.mock("@/components/auth/ProtectedRoute", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }) => <section>{children}</section>,
  DialogHeader: ({ children }) => <header>{children}</header>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

vi.mock("@/components/common/PageScaffold", () => ({
  PageShell: ({ children }) => <div>{children}</div>,
  PageHeader: ({ title, description, actions }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{actions}</div>
    </div>
  ),
}));

vi.mock("@/components/workspace/WorkspaceCard", () => ({
  default: ({ workspace, onClick }) => (
    <button type="button" onClick={onClick}>
      Open {workspace.name}
    </button>
  ),
}));

vi.mock("@/components/workspace/AccountSettingsPanel", () => ({
  default: () => <div>Account settings</div>,
}));

import Workspaces from "@/screens/Workspaces";

describe("Workspaces screen", () => {
  beforeEach(() => {
    vi.useRealTimers();
    navigate.mockReset();
    setWorkspaceSession.mockReset();
    fetchListMyWorkspacesCached.mockReset();
    ensureWorkspaceMembership.mockReset();
    joinWorkspaceWithCode.mockReset();
    parseWorkspaceSlug.mockReset();
    resolveWorkspaceJoinCandidate.mockReset();
    base44.auth.me.mockReset();
    base44.auth.redirectToLogin.mockReset();
    base44.functions.invoke.mockReset();
  });

  test("redirects unauthenticated users to login", async () => {
    base44.auth.me.mockRejectedValueOnce(new Error("not-authenticated"));

    render(<Workspaces />);

    await waitFor(() => {
      expect(base44.auth.redirectToLogin).toHaveBeenCalled();
    });
  });

  test("join workspace flow resolves link + access code", async () => {
    base44.auth.me.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
    fetchListMyWorkspacesCached.mockResolvedValue([]);
    parseWorkspaceSlug.mockReturnValue("acme");
    resolveWorkspaceJoinCandidate.mockResolvedValue({ status: "requires_code" });
    joinWorkspaceWithCode.mockResolvedValue({
      workspace: { id: "ws-1", slug: "acme", name: "Acme" },
      role: "contributor",
    });

    render(<Workspaces />);

    await screen.findByText("Your Workspaces");
    fireEvent.click(screen.getByRole("button", { name: "Join Workspace" }));
    const joinDialog = screen.getByRole("heading", { name: "Join Workspace" }).closest("section");

    fireEvent.change(within(joinDialog).getByPlaceholderText("Paste workspace URL or slug"), {
      target: { value: "https://app.local/workspace/acme/feedback" },
    });
    fireEvent.click(within(joinDialog).getByRole("button", { name: "Continue" }));

    await within(joinDialog).findByText("Join Code");
    fireEvent.change(within(joinDialog).getByPlaceholderText("Enter access code"), {
      target: { value: "acmecode" },
    });
    fireEvent.click(within(joinDialog).getAllByRole("button", { name: "Join Workspace" }).at(-1));

    await waitFor(() => {
      expect(joinWorkspaceWithCode).toHaveBeenCalledWith({
        slug: "acme",
        accessCode: "ACMECODE",
      });
    });

    expect(setWorkspaceSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({ slug: "acme" }),
        role: "contributor",
      })
    );
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining("/workspace/acme"));
  });

  test("create workspace flow validates slug and navigates to new workspace", async () => {
    base44.auth.me.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
    fetchListMyWorkspacesCached.mockResolvedValue([]);
    base44.functions.invoke.mockImplementation(async (fn, payload) => {
      if (fn === "checkWorkspaceSlug") {
        return { data: { available: true, slug: payload.slug } };
      }
      if (fn === "createWorkspace") {
        return { data: { id: "ws-new", slug: "newco", name: "NewCo" } };
      }
      return { data: {} };
    });

    render(<Workspaces />);

    await screen.findByText("Your Workspaces");
    fireEvent.click(screen.getByRole("button", { name: "Create Workspace" }));
    const createDialog = screen.getByRole("heading", { name: "Create New Workspace" }).closest("section");

    fireEvent.change(within(createDialog).getByPlaceholderText("e.g., Product Team"), {
      target: { value: "NewCo" },
    });
    fireEvent.change(within(createDialog).getByPlaceholderText("e.g., product-feedback"), {
      target: { value: "newco" },
    });

    await within(createDialog).findByText("Slug is available.", undefined, { timeout: 2500 });

    fireEvent.click(within(createDialog).getByRole("button", { name: "Create Workspace" }));
    await waitFor(() => {
      expect(base44.functions.invoke).toHaveBeenCalledWith(
        "createWorkspace",
        expect.objectContaining({ name: "NewCo", slug: "newco" }),
        { authMode: "user" }
      );
    });

    expect(setWorkspaceSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({ slug: "newco" }),
        role: "owner",
      })
    );
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining("/workspace/newco"));
  });
});
