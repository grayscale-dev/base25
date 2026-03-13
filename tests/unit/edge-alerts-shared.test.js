const {
  from,
  watchersSelect,
  watchersEqWorkspace,
  watchersEqItem,
  insert,
} = vi.hoisted(() => ({
  from: vi.fn(),
  watchersSelect: vi.fn(),
  watchersEqWorkspace: vi.fn(),
  watchersEqItem: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/supabase.ts", () => ({
  supabaseAdmin: { from },
}));

import {
  WATCH_ALERT_TYPES,
  createWatcherAlerts,
  isWatchAlertType,
} from "../../supabase/functions/_shared/alerts.ts";

describe("edge shared watcher alerts", () => {
  beforeEach(() => {
    from.mockReset();
    watchersSelect.mockReset();
    watchersEqWorkspace.mockReset();
    watchersEqItem.mockReset();
    insert.mockReset();

    from.mockImplementation((table) => {
      if (table === "item_watchers") {
        return { select: watchersSelect };
      }
      return { insert };
    });

    watchersSelect.mockReturnValue({ eq: watchersEqWorkspace });
    watchersEqWorkspace.mockReturnValue({ eq: watchersEqItem });
    insert.mockResolvedValue({ error: null });
  });

  test("enumerates supported alert types", () => {
    expect(WATCH_ALERT_TYPES).toContain("comment");
    expect(isWatchAlertType("status_change")).toBe(true);
    expect(isWatchAlertType("unknown")).toBe(false);
  });

  test("creates alerts for all watchers except actor", async () => {
    watchersEqItem.mockResolvedValue({
      data: [{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }],
      error: null,
    });

    await createWatcherAlerts({
      workspaceId: "w1",
      itemId: "it-1",
      itemActivityId: "act-1",
      alertType: "comment",
      actorUserId: "u2",
      title: "New comment",
      body: "A comment was posted",
      metadata: { key: "value" },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: "u1", alert_type: "comment" }),
        expect.objectContaining({ user_id: "u3", alert_type: "comment" }),
      ])
    );

    const rows = insert.mock.calls[0][0];
    expect(rows.some((row) => row.user_id === "u2")).toBe(false);
  });

  test("does not insert when watcher list is empty", async () => {
    watchersEqItem.mockResolvedValue({ data: [], error: null });

    await createWatcherAlerts({
      workspaceId: "w1",
      itemId: "it-1",
      itemActivityId: null,
      alertType: "type_change",
      actorUserId: null,
      title: "Type changed",
      body: "Changed",
    });

    expect(insert).not.toHaveBeenCalled();
  });
});
