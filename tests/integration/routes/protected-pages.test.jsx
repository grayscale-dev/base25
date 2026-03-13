import React from "react";
import { render, screen } from "@testing-library/react";

const requireServerAuth = vi.fn(async () => ({}));

vi.mock("@/lib/auth/server-guard", () => ({
  requireServerAuth,
}));

vi.mock("@/components/RoutePage", () => ({
  default: ({ currentPageName, children }) => (
    <section>
      <h1>Route: {currentPageName}</h1>
      {children}
    </section>
  ),
}));

vi.mock("@/screens/Alerts", () => ({ default: () => <div>Alerts Screen</div> }));
vi.mock("@/screens/Billing", () => ({ default: () => <div>Billing Screen</div> }));
vi.mock("@/screens/Search", () => ({ default: () => <div>Search Screen</div> }));
vi.mock("@/screens/WorkspaceSettings", () => ({ default: () => <div>Settings Screen</div> }));
vi.mock("@/screens/JoinWorkspace", () => ({ default: () => <div>Join Workspace Screen</div> }));
vi.mock("@/screens/Workspaces", () => ({ default: () => <div>Workspaces Screen</div> }));

function assertGuardCalled(path) {
  expect(requireServerAuth).toHaveBeenCalledWith(path);
}

describe("protected app pages", () => {
  beforeEach(() => {
    requireServerAuth.mockClear();
  });

  test("alerts page requires auth and renders", async () => {
    const AlertsPage = (await import("../../../app/alerts/page.jsx")).default;
    const element = await AlertsPage();
    render(element);
    assertGuardCalled("/alerts");
    expect(screen.getByText("Alerts Screen")).toBeInTheDocument();
  });

  test("search page requires auth and renders", async () => {
    const SearchPage = (await import("../../../app/search/page.jsx")).default;
    const element = await SearchPage();
    render(element);
    assertGuardCalled("/search");
    expect(screen.getByText("Search Screen")).toBeInTheDocument();
  });

  test("billing page requires auth and renders", async () => {
    const BillingPage = (await import("../../../app/billing/page.jsx")).default;
    const element = await BillingPage();
    render(element);
    assertGuardCalled("/billing");
    expect(screen.getByText("Billing Screen")).toBeInTheDocument();
  });

  test("workspace settings requires auth and renders", async () => {
    const WorkspaceSettingsPage = (await import("../../../app/workspace-settings/page.jsx")).default;
    const element = await WorkspaceSettingsPage();
    render(element);
    assertGuardCalled("/workspace-settings");
    expect(screen.getByText("Settings Screen")).toBeInTheDocument();
  });

  test("join workspace and workspaces pages require auth", async () => {
    const JoinWorkspacePage = (await import("../../../app/join-workspace/page.jsx")).default;
    const WorkspacesPage = (await import("../../../app/workspaces/page.jsx")).default;

    const { rerender } = render(await JoinWorkspacePage());
    assertGuardCalled("/join-workspace");
    expect(screen.getByText("Join Workspace Screen")).toBeInTheDocument();

    rerender(await WorkspacesPage());
    assertGuardCalled("/workspaces");
    expect(screen.getByText("Workspaces Screen")).toBeInTheDocument();
  });
});
