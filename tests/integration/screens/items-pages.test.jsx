import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/screens/items/ItemEditorDialog", () => ({
  default: ({ open, onSave, contributorFeedbackMode }) =>
    open ? (
      <div>
        <p>Editor open</p>
        <p>Contributor mode: {String(Boolean(contributorFeedbackMode))}</p>
        <button
          type="button"
          onClick={() =>
            onSave({
              status_id: "status-1",
              item_type_id: "type-1",
              title: "New item",
              description: "Details",
              metadata: {},
            })
          }
        >
          Save Editor
        </button>
      </div>
    ) : null,
}));

vi.mock("@/screens/items/ItemDetailDrawer", () => ({
  default: ({ open, item }) =>
    open ? <div>Drawer for {item?.id || "none"}</div> : null,
}));

vi.mock("@/components/workspace/WorkspaceItemCard", () => ({
  default: ({ item, onOpen, onToggleWatch }) => (
    <article>
      <p>{item.title}</p>
      <button type="button" onClick={onOpen}>
        Open card {item.id}
      </button>
      <button type="button" onClick={() => onToggleWatch(item)}>
        Toggle card watch {item.id}
      </button>
    </article>
  ),
}));

import AllItemsPage from "@/screens/items/AllItemsPage";
import GroupItemsPage from "@/screens/items/GroupItemsPage";

function makeController(overrides = {}) {
  return {
    isAdmin: true,
    loadingConfig: false,
    loadingItems: false,
    savingItem: false,
    error: "",
    items: [
      {
        id: "item-1",
        title: "Improve onboarding",
        description: "Tighten setup flow",
        group_key: "feedback",
        group_color: "#123456",
        status_id: "status-1",
        status_label: "Open",
        item_type_label: "Feature",
        item_type_id: "type-1",
        updated_at: "2026-03-10T12:00:00.000Z",
        created_at: "2026-03-10T12:00:00.000Z",
        assignee: { name: "Ada Lovelace", profile_photo_url: null },
      },
    ],
    statuses: [{ id: "status-1", label: "Open", group_key: "feedback" }],
    statusesByGroup: {
      feedback: [{ id: "status-1", label: "Open", group_key: "feedback" }],
      roadmap: [{ id: "status-r1", label: "Planned", group_key: "roadmap" }],
      changelog: [],
    },
    assignableMembers: [{ user_id: "admin-1", display_name: "Ada Lovelace" }],
    itemTypes: [{ id: "type-1", label: "Feature" }],
    memberDirectoryById: new Map(),
    selectedItem: null,
    canManageAssignee: true,
    setSelectedItem: vi.fn(),
    hydrateItem: vi.fn((item) => item),
    loadItems: vi.fn().mockResolvedValue(undefined),
    loadItemActivities: vi.fn().mockResolvedValue(undefined),
    saveItem: vi.fn().mockResolvedValue({ ok: true, item: { id: "item-2" } }),
    setError: vi.fn(),
    toggleItemWatch: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe("AllItemsPage", () => {
  test("shows skeleton while loading empty table", () => {
    const controller = makeController({ loadingConfig: true, loadingItems: true, items: [] });

    render(<AllItemsPage workspace={{ id: "ws-1", name: "Acme", slug: "acme" }} controller={controller} />);

    expect(screen.getByText("All Items")).toBeInTheDocument();
    expect(screen.queryByText("No items found")).not.toBeInTheDocument();
  });

  test("opens row in drawer and loads activities", async () => {
    const controller = makeController();

    render(<AllItemsPage workspace={{ id: "ws-1", name: "Acme", slug: "acme" }} controller={controller} />);

    fireEvent.click(screen.getByText("Improve onboarding"));

    await waitFor(() => {
      expect(controller.setSelectedItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: "item-1" })
      );
      expect(controller.loadItemActivities).toHaveBeenCalledWith(
        expect.objectContaining({ id: "item-1" })
      );
    });

  });

  test("creates a new item from editor flow", async () => {
    const controller = makeController();

    render(<AllItemsPage workspace={{ id: "ws-1", name: "Acme", slug: "acme" }} controller={controller} />);

    fireEvent.click(screen.getByRole("button", { name: "Create Item" }));
    expect(screen.getByText("Editor open")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Editor" }));

    await waitFor(() => {
      expect(controller.saveItem).toHaveBeenCalled();
      expect(controller.loadItems).toHaveBeenCalledWith(
        expect.objectContaining({ groupKey: null, statusId: "all", force: true })
      );
    });
  });
});

describe("GroupItemsPage", () => {
  test("contributor feedback flow uses submit-feedback mode", async () => {
    const controller = makeController({
      isAdmin: false,
      canManageAssignee: false,
    });

    render(
      <GroupItemsPage
        groupKey="feedback"
        workspace={{ id: "ws-1", name: "Acme", slug: "acme" }}
        role="contributor"
        isPublicAccess={false}
        controller={controller}
      />
    );

    expect(screen.getByRole("button", { name: "Submit Feedback" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit Feedback" }));

    expect(screen.getByText("Contributor mode: true")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Editor" }));
    await waitFor(() => {
      expect(controller.saveItem).toHaveBeenCalled();
      expect(controller.loadItems).toHaveBeenCalledWith(
        expect.objectContaining({ groupKey: "feedback", statusId: "all", force: true })
      );
    });
  });

  test("opens item thread and toggles watch from card", async () => {
    const controller = makeController({
      setSelectedItem: vi.fn(),
      loadItemActivities: vi.fn().mockResolvedValue(undefined),
      toggleItemWatch: vi.fn().mockResolvedValue({ ok: true }),
    });

    render(
      <GroupItemsPage
        groupKey="feedback"
        workspace={{ id: "ws-1", name: "Acme", slug: "acme" }}
        role="owner"
        isPublicAccess={false}
        controller={controller}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open card item-1" }));

    await waitFor(() => {
      expect(controller.setSelectedItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: "item-1" })
      );
      expect(controller.loadItemActivities).toHaveBeenCalledWith(
        expect.objectContaining({ id: "item-1" })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Toggle card watch item-1" }));
    await waitFor(() => {
      expect(controller.toggleItemWatch).toHaveBeenCalledWith("item-1");
    });
  });
});
