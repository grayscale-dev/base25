import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  useLocation,
  isAuthenticated,
  logUserInApp,
  me,
  Layout,
} = vi.hoisted(() => ({
  useLocation: vi.fn(),
  isAuthenticated: vi.fn(),
  logUserInApp: vi.fn().mockResolvedValue(undefined),
  me: vi.fn(),
  Layout: vi.fn(({ currentPageName, children }) => (
    <div>
      <span>Layout:{currentPageName}</span>
      {children}
    </div>
  )),
}));

vi.mock("@/Layout", () => ({
  default: (props) => Layout(props),
}));

vi.mock("@/lib/router", () => ({
  useLocation: () => useLocation(),
}));

vi.mock("@/api/base44Client", () => ({
  base44: {
    auth: {
      isAuthenticated,
      me,
    },
    appLogs: {
      logUserInApp,
    },
  },
}));

import RoutePage from "@/components/RoutePage";
import AppProviders from "@/components/AppProviders";
import NavigationTracker from "@/lib/NavigationTracker";
import PageNotFound from "@/lib/PageNotFound";

function renderWithQuery(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("app shell components", () => {
  beforeEach(() => {
    useLocation.mockReset();
    isAuthenticated.mockReset();
    logUserInApp.mockReset();
    me.mockReset();
    Layout.mockClear();
    logUserInApp.mockResolvedValue(undefined);
    useLocation.mockReturnValue({ pathname: "/workspace/acme/feedback", search: "", hash: "" });
  });

  test("RoutePage forwards page name + content to Layout", () => {
    render(
      <RoutePage currentPageName="Feedback">
        <div>Inner page</div>
      </RoutePage>
    );

    expect(screen.getByText("Layout:Feedback")).toBeInTheDocument();
    expect(screen.getByText("Inner page")).toBeInTheDocument();
  });

  test("AppProviders renders children inside provider tree", () => {
    render(
      <AppProviders>
        <div>Provider child</div>
      </AppProviders>
    );

    expect(screen.getByText("Provider child")).toBeInTheDocument();
  });

  test("NavigationTracker logs page views for authenticated users", async () => {
    useLocation.mockReturnValue({ pathname: "/workspace/acme/feedback" });
    isAuthenticated.mockResolvedValue(true);

    render(<NavigationTracker />);

    await waitFor(() => {
      expect(logUserInApp).toHaveBeenCalledWith("Workspace");
    });
  });

  test("PageNotFound shows admin note for staff user", async () => {
    useLocation.mockReturnValue({ pathname: "/missing-route", search: "", hash: "" });
    me.mockResolvedValue({ id: "u1", role: "owner" });

    renderWithQuery(<PageNotFound />);

    expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Admin Note/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Go Home/i })).toHaveAttribute("href", "/");
  });

  test("PageNotFound hides admin note for unauthenticated users", async () => {
    useLocation.mockReturnValue({ pathname: "/missing-route", search: "", hash: "" });
    me.mockRejectedValue(new Error("not authenticated"));

    renderWithQuery(<PageNotFound />);

    expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
    expect(screen.queryByText(/Admin Note/i)).not.toBeInTheDocument();
  });
});
