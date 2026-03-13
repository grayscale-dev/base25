import {
  workspaceQueryKeys,
  fetchWorkspaceBootstrap,
  fetchWorkspaceItems,
  fetchUnreadAlertCount,
} from "@/lib/workspace-queries";

const { invoke, me, filter } = vi.hoisted(() => ({
  invoke: vi.fn(),
  me: vi.fn(),
  filter: vi.fn(),
}));

vi.mock("@/api/base44Client", () => ({
  base44: {
    functions: { invoke },
    auth: { me },
    entities: {
      WorkspaceRole: { filter },
      Workspace: { filter },
    },
  },
}));

describe("workspace query keys", () => {
  test("builds stable keys", () => {
    expect(workspaceQueryKeys.bootstrap({ slug: "Acme", section: "feedback" })).toEqual([
      "workspaceBootstrap",
      "acme",
      "feedback",
      "all",
      "config",
      80,
    ]);
  });
});

describe("workspace query fetchers", () => {
  beforeEach(() => {
    invoke.mockReset();
    me.mockReset();
    filter.mockReset();
  });

  test("fetchWorkspaceBootstrap uses consolidated function", async () => {
    invoke.mockResolvedValueOnce({ data: { id: "w1", slug: "acme" } });

    const data = await fetchWorkspaceBootstrap({ slug: "acme", section: "feedback", includeItems: true });

    expect(invoke).toHaveBeenCalledWith(
      "workspaceBootstrap",
      expect.objectContaining({ slug: "acme", section: "feedback", include_items: true }),
      { authMode: "user" }
    );
    expect(data).toEqual({ id: "w1", slug: "acme" });
  });

  test("fetchWorkspaceItems forwards watched_only and limit", async () => {
    invoke.mockResolvedValueOnce({ data: { items: [{ id: "it1" }] } });
    const items = await fetchWorkspaceItems({ workspaceId: "w1", watchedOnly: true, limit: 999 });

    expect(invoke).toHaveBeenCalledWith(
      "listItems",
      expect.objectContaining({ workspace_id: "w1", watched_only: true, limit: 200 }),
      { authMode: "user" }
    );
    expect(items).toEqual([{ id: "it1" }]);
  });

  test("fetchUnreadAlertCount coerces numeric response", async () => {
    invoke.mockResolvedValueOnce({ data: { unread_count: "3" } });
    const count = await fetchUnreadAlertCount({ workspaceId: "w1" });
    expect(count).toBe(3);
  });
});
