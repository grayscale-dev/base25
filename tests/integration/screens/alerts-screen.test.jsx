import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  navigate,
  getWorkspaceSession,
  fetchWorkspaceAlertsCached,
  fetchWorkspaceItemsCached,
  invalidateWorkspaceAlertQueries,
  base44,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  getWorkspaceSession: vi.fn(),
  fetchWorkspaceAlertsCached: vi.fn(),
  fetchWorkspaceItemsCached: vi.fn(),
  invalidateWorkspaceAlertQueries: vi.fn(),
  base44: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/lib/router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/api/base44Client", () => ({ base44 }));
vi.mock("@/lib/workspace-session", () => ({ getWorkspaceSession }));
vi.mock("@/lib/workspace-queries", () => ({
  fetchWorkspaceAlertsCached,
  fetchWorkspaceItemsCached,
  invalidateWorkspaceAlertQueries,
}));

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

import Alerts from "@/screens/Alerts";

function session(overrides = {}) {
  return {
    workspace: { id: "ws-1", slug: "acme", name: "Acme" },
    role: "owner",
    isPublicAccess: false,
    ...overrides,
  };
}

describe("Alerts screen", () => {
  beforeEach(() => {
    navigate.mockReset();
    getWorkspaceSession.mockReset();
    fetchWorkspaceAlertsCached.mockReset();
    fetchWorkspaceItemsCached.mockReset();
    invalidateWorkspaceAlertQueries.mockReset();
    base44.functions.invoke.mockReset();

    getWorkspaceSession.mockReturnValue(session());
    fetchWorkspaceAlertsCached.mockResolvedValue([
      {
        id: "a1",
        alert_type: "status_change",
        title: "Status changed",
        body: "Moved to in progress",
        created_at: "2026-03-10T12:00:00.000Z",
        item: {
          id: "item-1",
          title: "Fix API timeout",
          watched: true,
          watcher_count: 3,
        },
      },
    ]);
    fetchWorkspaceItemsCached.mockResolvedValue([
      { id: "item-1", title: "Fix API timeout", watched: true, watcher_count: 3 },
    ]);
    base44.functions.invoke.mockResolvedValue({ data: { members: [] } });
  });

  test("redirects to workspaces when no workspace in session", async () => {
    getWorkspaceSession.mockReturnValue({ workspace: null, role: "contributor", isPublicAccess: false });

    render(<Alerts />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/workspaces", { replace: true });
    });
  });

  test("loads alerts and supports open + watch toggle", async () => {
    base44.functions.invoke
      .mockResolvedValueOnce({ data: { marked: true } })
      .mockResolvedValueOnce({ data: { members: [] } })
      .mockResolvedValueOnce({ data: { watched: false, watcher_count: 2 } });

    render(<Alerts />);

    expect(await screen.findByText("Fix API timeout")).toBeInTheDocument();

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

  test("switches to watched items view and refreshes watched list", async () => {
    base44.functions.invoke
      .mockResolvedValueOnce({ data: { marked: true } })
      .mockResolvedValueOnce({ data: { members: [] } });

    render(<Alerts />);

    await screen.findByText("Fix API timeout");
    fireEvent.click(screen.getByRole("button", { name: "Watched Items" }));

    await waitFor(() => {
      expect(fetchWorkspaceItemsCached).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "ws-1", watchedOnly: true })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => {
      expect(fetchWorkspaceItemsCached).toHaveBeenCalledTimes(2);
    });
  });

  test("shows retry panel on alert load failure", async () => {
    fetchWorkspaceAlertsCached.mockRejectedValueOnce(new Error("boom"));
    base44.functions.invoke.mockResolvedValueOnce({ data: { marked: false } });

    render(<Alerts />);

    expect(await screen.findByText("Unable to load alerts")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(invalidateWorkspaceAlertQueries).toHaveBeenCalledWith("ws-1");
    });
  });
});
