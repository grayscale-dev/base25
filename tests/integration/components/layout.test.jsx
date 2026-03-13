import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const {
  navigate,
  useLocation,
  getWorkspaceSession,
  fetchListMyWorkspacesCached,
  fetchUnreadAlertCountCached,
  base44,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  useLocation: vi.fn(),
  getWorkspaceSession: vi.fn(),
  fetchListMyWorkspacesCached: vi.fn(),
  fetchUnreadAlertCountCached: vi.fn(),
  base44: {
    auth: {
      me: vi.fn(),
      logout: vi.fn(),
    },
  },
}));

vi.mock("@/lib/router", () => ({
  useNavigate: () => navigate,
  useLocation: () => useLocation(),
}));

vi.mock("@/api/base44Client", () => ({ base44 }));
vi.mock("@/lib/workspace-session", () => ({
  getWorkspaceSession,
  setWorkspaceSession: vi.fn(),
}));
vi.mock("@/lib/workspace-queries", () => ({
  fetchListMyWorkspacesCached,
  fetchUnreadAlertCountCached,
  invalidateWorkspaceAlertQueries: vi.fn(),
}));

vi.mock("@/components/context/WorkspaceContext", () => ({
  WorkspaceProvider: ({ children }) => <>{children}</>,
}));

vi.mock("@/components/workspace/WorkspaceAvatar", () => ({
  default: ({ workspace }) => <span>{workspace?.name || "Portal"}</span>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ asChild, children }) => (asChild ? children : <button>{children}</button>),
  DropdownMenuContent: ({ children }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/components/ui/sheet", async () => {
  const React = await import("react");
  const Ctx = React.createContext(null);

  function Sheet({ open, onOpenChange, children }) {
    return <Ctx.Provider value={{ open, onOpenChange }}>{children}</Ctx.Provider>;
  }

  function SheetTrigger({ asChild, children }) {
    const ctx = React.useContext(Ctx);
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        "data-testid": "mobile-sheet-trigger",
        onClick: () => ctx?.onOpenChange?.(true),
      });
    }
    return null;
  }

  function SheetContent({ children }) {
    return <div data-testid="mobile-sheet">{children}</div>;
  }

  return { Sheet, SheetTrigger, SheetContent };
});

import Layout from "@/Layout";

describe("Layout", () => {
  beforeEach(() => {
    navigate.mockReset();
    base44.auth.me.mockReset();
    base44.auth.logout.mockReset();
    getWorkspaceSession.mockReset();
    fetchListMyWorkspacesCached.mockReset();
    fetchUnreadAlertCountCached.mockReset();
    useLocation.mockReset();

    useLocation.mockReturnValue({
      pathname: "/workspace/acme/feedback",
      search: "",
      hash: "",
    });
    base44.auth.me.mockResolvedValue({ id: "u1", email: "owner@example.com" });
    getWorkspaceSession.mockReturnValue({
      workspace: { id: "w1", slug: "acme", name: "Acme", primary_color: "#004cff" },
      role: "owner",
      isPublicAccess: false,
      billingBlocked: false,
    });
    fetchListMyWorkspacesCached.mockResolvedValue([{ id: "w1", slug: "acme", name: "Acme", role: "owner" }]);
    fetchUnreadAlertCountCached.mockResolvedValue(2);
  });

  test("renders workspace shell and admin nav", async () => {
    render(
      <Layout currentPageName="Feedback">
        <div>Page body</div>
      </Layout>
    );

    await waitFor(() => {
      expect(screen.getByText("Page body")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /feedback/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /settings/i }).length).toBeGreaterThan(0);
  });

  test("mobile sheet supports settings and sign-out actions", async () => {
    render(
      <Layout currentPageName="Feedback">
        <div>Page body</div>
      </Layout>
    );

    await screen.findByText("Page body");
    fireEvent.click(screen.getByTestId("mobile-sheet-trigger"));
    expect(screen.getByTestId("mobile-sheet")).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId("mobile-sheet")).getByRole("button", { name: "Settings" })
    );
    expect(navigate).toHaveBeenCalledWith("/workspace-settings");

    fireEvent.click(
      within(screen.getByTestId("mobile-sheet")).getByRole("button", { name: /sign out/i })
    );
    expect(base44.auth.logout).toHaveBeenCalled();
  });
});
