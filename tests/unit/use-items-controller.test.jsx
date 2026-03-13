import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";

const {
  base44,
  fetchWorkspaceBootstrapCached,
  fetchWorkspaceItemsCached,
  invalidateWorkspaceItemQueries,
} = vi.hoisted(() => ({
  base44: {
    auth: {
      me: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
    entities: {
      Item: {
        update: vi.fn(),
        delete: vi.fn(),
      },
      ItemActivity: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  },
  fetchWorkspaceBootstrapCached: vi.fn(),
  fetchWorkspaceItemsCached: vi.fn(),
  invalidateWorkspaceItemQueries: vi.fn(),
}));

vi.mock("@/api/base44Client", () => ({ base44 }));
vi.mock("@/lib/workspace-queries", () => ({
  fetchWorkspaceBootstrapCached,
  fetchWorkspaceItemsCached,
  invalidateWorkspaceItemQueries,
}));

import { useItemsController } from "@/screens/items/useItemsController";

function baseBootstrap(overrides = {}) {
  return {
    groups: [{ id: "g-feedback", group_key: "feedback", color_hex: "#334455", display_order: 0 }],
    statuses: [
      {
        id: "status-feedback-open",
        group_key: "feedback",
        label: "Open",
        display_order: 0,
        is_active: true,
      },
    ],
    item_types: [{ id: "type-feature", label: "Feature", display_order: 0, is_active: true }],
    items: [],
    ...overrides,
  };
}

describe("useItemsController", () => {
  beforeEach(() => {
    base44.auth.me.mockReset();
    base44.functions.invoke.mockReset();
    base44.entities.Item.update.mockReset();
    base44.entities.Item.delete.mockReset();
    base44.entities.ItemActivity.create.mockReset();
    base44.entities.ItemActivity.update.mockReset();
    base44.entities.ItemActivity.delete.mockReset();
    fetchWorkspaceBootstrapCached.mockReset();
    fetchWorkspaceItemsCached.mockReset();
    invalidateWorkspaceItemQueries.mockReset();

    base44.auth.me.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
    fetchWorkspaceBootstrapCached.mockResolvedValue(baseBootstrap());
    fetchWorkspaceItemsCached.mockResolvedValue([]);

    base44.functions.invoke.mockImplementation(async (fn) => {
      if (fn === "listWorkspaceMemberDirectory") return { data: { members: [] } };
      if (fn === "listItemActivities") return { data: { activities: [] } };
      if (fn === "getItemEngagement") {
        return {
          data: {
            watched: false,
            watcher_count: 0,
            item_reactions: [],
            item_reaction_count: 0,
            comment_reactions: {},
          },
        };
      }
      if (fn === "createItem") {
        return {
          data: {
            item: {
              id: "item-created",
              title: "Created",
              status_id: "status-feedback-open",
              item_type_id: "type-feature",
              group_key: "feedback",
            },
          },
        };
      }
      return { data: {} };
    });
  });

  test("sets workspace-missing error when no workspace is provided", async () => {
    const { result } = renderHook(() =>
      useItemsController({ workspace: null, role: "owner", isPublicAccess: false })
    );

    await waitFor(() => {
      expect(result.current.error).toBe("Workspace context is missing.");
    });
  });

  test("loads items and hydrates status/type/group fields", async () => {
    fetchWorkspaceItemsCached.mockResolvedValueOnce([
      {
        id: "item-1",
        title: "Fix login",
        status_id: "status-feedback-open",
        item_type_id: "type-feature",
        group_key: "feedback",
      },
    ]);

    const { result } = renderHook(() =>
      useItemsController({
        workspace: { id: "ws-1", slug: "acme" },
        role: "owner",
        isPublicAccess: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loadingConfig).toBe(false);
    });

    await act(async () => {
      await result.current.loadItems({ groupKey: "feedback", statusId: "all", force: true });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual(
      expect.objectContaining({
        title: "Fix login",
        status_label: "Open",
        item_type_label: "Feature",
        group_label: "Feedback",
      })
    );
  });

  test("applies contributor defaults on create and blocks unauthorized edit", async () => {
    const { result } = renderHook(() =>
      useItemsController({
        workspace: { id: "ws-1", slug: "acme" },
        role: "contributor",
        isPublicAccess: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loadingConfig).toBe(false);
    });

    let saveResult;
    await act(async () => {
      saveResult = await result.current.saveItem({
        payload: {
          title: "Need export",
          description: "Please add csv export",
          metadata: {},
          visibility: "public",
        },
      });
    });

    expect(saveResult.ok).toBe(true);
    expect(base44.functions.invoke).toHaveBeenCalledWith(
      "createItem",
      expect.objectContaining({
        workspace_id: "ws-1",
        status_id: "status-feedback-open",
        item_type_id: "type-feature",
        assigned_to: null,
      }),
      { authMode: "user" }
    );

    await act(async () => {
      const blocked = await result.current.saveItem({
        payload: { id: "item-2", title: "X" },
        previousItem: { id: "item-2", submitter_id: "another-user" },
      });
      expect(blocked).toEqual({ ok: false, error: "You can only edit feedback you submitted." });
    });
  });

  test("toggles watch with optimistic update and rolls back on failure", async () => {
    const { result } = renderHook(() =>
      useItemsController({
        workspace: { id: "ws-1", slug: "acme" },
        role: "owner",
        isPublicAccess: false,
        bootstrapData: {
          groups: baseBootstrap().groups,
          statuses: baseBootstrap().statuses,
          itemTypes: baseBootstrap().item_types,
          items: [
            {
              id: "item-1",
              title: "Bug",
              status_id: "status-feedback-open",
              item_type_id: "type-feature",
              group_key: "feedback",
              watched: false,
              watcher_count: 0,
            },
          ],
          section: "feedback",
        },
      })
    );

    await waitFor(() => {
      expect(result.current.items[0]?.id).toBe("item-1");
    });

    base44.functions.invoke.mockRejectedValueOnce(new Error("watch failed"));

    let watchResult;
    await act(async () => {
      watchResult = await result.current.toggleItemWatch("item-1");
    });

    expect(watchResult.ok).toBe(false);
    expect(result.current.items[0].watched).toBe(false);
    expect(result.current.items[0].watcher_count).toBe(0);
  });

  test("toggles item and comment reactions with server reconciliation", async () => {
    const { result } = renderHook(() =>
      useItemsController({
        workspace: { id: "ws-1", slug: "acme" },
        role: "owner",
        isPublicAccess: false,
        bootstrapData: {
          groups: baseBootstrap().groups,
          statuses: baseBootstrap().statuses,
          itemTypes: baseBootstrap().item_types,
          items: [
            {
              id: "item-1",
              title: "Bug",
              status_id: "status-feedback-open",
              item_type_id: "type-feature",
              group_key: "feedback",
              reaction_count: 0,
              reaction_summary: [],
            },
          ],
          section: "feedback",
        },
      })
    );

    await waitFor(() => {
      expect(result.current.items[0]?.id).toBe("item-1");
    });

    base44.functions.invoke.mockImplementation(async (fn) => {
      if (fn === "toggleItemReaction") {
        return {
          data: {
            reactions: [{ emoji: "👍", count: 2, reacted: true }],
            reaction_count: 2,
          },
        };
      }
      if (fn === "toggleCommentReaction") {
        return { data: { reactions: [{ emoji: "🔥", count: 1, reacted: true }] } };
      }
      return { data: {} };
    });

    await act(async () => {
      const reactionResult = await result.current.toggleItemReaction("item-1", "👍");
      expect(reactionResult.ok).toBe(true);
    });

    expect(result.current.items[0].reaction_count).toBe(2);
    expect(result.current.items[0].reaction_summary).toEqual([
      { emoji: "👍", count: 2, reacted: true },
    ]);

    await act(async () => {
      const commentReactionResult = await result.current.toggleCommentReaction("comment-1", "🔥");
      expect(commentReactionResult.ok).toBe(true);
    });

    expect(result.current.itemEngagement.comment_reactions["comment-1"]).toEqual([
      { emoji: "🔥", count: 1, reacted: true },
    ]);
  });
});
