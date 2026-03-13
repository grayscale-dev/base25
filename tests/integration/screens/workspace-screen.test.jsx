import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  navigate,
  params,
  prefetch,
  fetchWorkspaceBootstrapCached,
  invalidateWorkspaceBootstrapQueries,
  openStripeBilling,
  setWorkspaceSession,
  base44,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: vi.fn(),
  prefetch: vi.fn(),
  fetchWorkspaceBootstrapCached: vi.fn(),
  invalidateWorkspaceBootstrapQueries: vi.fn(),
  openStripeBilling: vi.fn(),
  setWorkspaceSession: vi.fn(),
  base44: {
    auth: {
      logout: vi.fn(),
      redirectToLogin: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch }),
}));

vi.mock("@/lib/router", () => ({
  useNavigate: () => navigate,
  useParams: () => params(),
}));

vi.mock("@/api/base44Client", () => ({ base44 }));
vi.mock("@/lib/workspace-queries", () => ({
  fetchWorkspaceBootstrapCached,
  invalidateWorkspaceBootstrapQueries,
}));
vi.mock("@/lib/openStripeBilling", () => ({ openStripeBilling }));
vi.mock("@/lib/workspace-session", () => ({ setWorkspaceSession }));

vi.mock("@/screens/Items", () => ({
  default: ({ section }) => <div>Items section: {section}</div>,
}));

vi.mock("@/screens/items/WorkspaceItemView", () => ({
  default: ({ itemId }) => <div>Item view for: {itemId}</div>,
}));

import Workspace from "@/screens/Workspace";

function bootstrapPayload(overrides = {}) {
  return {
    id: "ws-1",
    name: "Acme",
    slug: "acme",
    description: "",
    primary_color: "#0f172a",
    visibility: "restricted",
    billing_status: "active",
    billing_access_allowed: true,
    role: "owner",
    is_public_access: false,
    groups: [],
    statuses: [],
    item_types: [],
    items: [],
    ...overrides,
  };
}

describe("Workspace screen", () => {
  beforeEach(() => {
    navigate.mockReset();
    params.mockReset();
    prefetch.mockReset();
    fetchWorkspaceBootstrapCached.mockReset();
    invalidateWorkspaceBootstrapQueries.mockReset();
    openStripeBilling.mockReset();
    setWorkspaceSession.mockReset();
    base44.auth.logout.mockReset();
    base44.auth.redirectToLogin.mockReset();
    base44.functions.invoke.mockReset();

    params.mockReturnValue({ slug: "acme" });
    fetchWorkspaceBootstrapCached.mockResolvedValue(bootstrapPayload());
    openStripeBilling.mockResolvedValue({ ok: true });
  });

  test("redirects items alias to the role default section", async () => {
    render(<Workspace section="items" />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/workspace/acme/all", { replace: true });
    });
  });

  test("shows private access-code gate and joins workspace", async () => {
    fetchWorkspaceBootstrapCached.mockRejectedValue({ context: { status: 403 } });
    base44.functions.invoke.mockResolvedValueOnce({
      data: {
        workspace: { id: "ws-1", slug: "acme", name: "Acme" },
        role: "contributor",
      },
    });

    render(<Workspace section="feedback" />);

    await screen.findByText("Enter access code");
    fireEvent.change(screen.getByPlaceholderText("Access code"), {
      target: { value: "abc123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Join Workspace" }));

    await waitFor(() => {
      expect(base44.functions.invoke).toHaveBeenCalledWith(
        "joinWorkspaceWithAccessCode",
        { slug: "acme", access_code: "abc123" }
      );
    });
    expect(setWorkspaceSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({ slug: "acme" }),
        role: "contributor",
      })
    );
    expect(navigate).toHaveBeenCalledWith("/workspace/acme/feedback", { replace: true });
  });

  test("shows billing gate for owner, opens billing, and supports delete", async () => {
    fetchWorkspaceBootstrapCached.mockResolvedValue(
      bootstrapPayload({
        role: "owner",
        billing_status: "inactive",
        billing_access_allowed: false,
      })
    );

    base44.functions.invoke.mockResolvedValue({ data: {} });

    render(<Workspace section="feedback" />);

    await screen.findByText("Billing setup required");

    fireEvent.click(screen.getByRole("button", { name: "Go to Billing" }));
    await waitFor(() => {
      expect(openStripeBilling).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-1",
          mode: "subscribe",
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Workspace" }));
    const deleteButtons = await screen.findAllByRole("button", { name: "Delete Workspace" });
    fireEvent.click(deleteButtons.at(-1));

    await waitFor(() => {
      expect(base44.functions.invoke).toHaveBeenCalledWith(
        "archiveWorkspace",
        { workspace_id: "ws-1" },
        { authMode: "user" }
      );
    });
    expect(navigate).toHaveBeenCalledWith("/workspaces");
  });

  test("renders full item view when section is item", async () => {
    render(<Workspace section="item" itemId="item-7" />);
    expect(await screen.findByText("Item view for: item-7")).toBeInTheDocument();
  });
});
