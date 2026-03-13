import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  navigate,
  location,
  getWorkspaceSession,
  fetchWorkspaceSearchCached,
  base44,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: vi.fn(),
  getWorkspaceSession: vi.fn(),
  fetchWorkspaceSearchCached: vi.fn(),
  base44: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/lib/router", () => ({
  useNavigate: () => navigate,
  useLocation: () => location(),
}));

vi.mock("@/api/base44Client", () => ({ base44 }));
vi.mock("@/lib/workspace-session", () => ({ getWorkspaceSession }));
vi.mock("@/lib/workspace-queries", () => ({ fetchWorkspaceSearchCached }));

vi.mock("@/components/workspace/WorkspaceItemCard", () => ({
  default: ({ item, onOpen, onToggleWatch, watchToggleDisabled }) => (
    <article>
      <p>{item.title}</p>
      <button type="button" onClick={onOpen}>
        Open {item.id}
      </button>
      <button
        type="button"
        disabled={watchToggleDisabled}
        onClick={() => onToggleWatch(item)}
      >
        Toggle watch {item.id}
      </button>
    </article>
  ),
}));

import Search from "@/screens/Search";

function session(overrides = {}) {
  return {
    workspace: { id: "ws-1", slug: "acme", name: "Acme" },
    role: "owner",
    isPublicAccess: false,
    ...overrides,
  };
}

describe("Search screen", () => {
  beforeEach(() => {
    navigate.mockReset();
    location.mockReset();
    getWorkspaceSession.mockReset();
    fetchWorkspaceSearchCached.mockReset();
    base44.functions.invoke.mockReset();

    location.mockReturnValue({ pathname: "/search", search: "" });
    getWorkspaceSession.mockReturnValue(session());
    fetchWorkspaceSearchCached.mockResolvedValue([]);
    base44.functions.invoke.mockResolvedValue({ data: { members: [] } });
  });

  test("redirects to workspaces when no workspace session exists", async () => {
    getWorkspaceSession.mockReturnValue({ workspace: null, role: "contributor", isPublicAccess: false });

    render(<Search />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/workspaces", { replace: true });
    });
  });

  test("loads and renders query results and supports open + watch toggle", async () => {
    location.mockReturnValue({ pathname: "/search", search: "?q=latency" });
    fetchWorkspaceSearchCached.mockResolvedValueOnce([
      {
        id: "item-1",
        title: "Fix latency",
        watched: false,
        watcher_count: 0,
      },
    ]);
    base44.functions.invoke.mockResolvedValue({ data: { watched: true, watcher_count: 1 } });

    render(<Search />);

    expect(await screen.findByText("Fix latency")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open item-1" }));
    expect(navigate).toHaveBeenCalledWith("/workspace/acme/item/item-1");

    fireEvent.click(screen.getByRole("button", { name: "Toggle watch item-1" }));
    await waitFor(() => {
      expect(base44.functions.invoke).toHaveBeenCalledWith(
        "toggleItemWatch",
        { workspace_id: "ws-1", item_id: "item-1" },
        { authMode: "user" }
      );
    });
  });

  test("submits search query from form", async () => {
    render(<Search />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search workspace" }), {
      target: { value: "onboarding" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(navigate).toHaveBeenCalledWith("/search?q=onboarding");
  });

  test("shows retry state when search fails", async () => {
    location.mockReturnValue({ pathname: "/search", search: "?q=bug" });
    fetchWorkspaceSearchCached.mockRejectedValueOnce(new Error("boom"));

    render(<Search />);

    expect(await screen.findByText("Search failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(navigate).toHaveBeenCalledWith("/search?q=bug");
  });
});
