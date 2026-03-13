import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  navigate,
  filterItems,
  useItemsControllerMock,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  filterItems: vi.fn(),
  useItemsControllerMock: vi.fn(),
}));

vi.mock("@/lib/router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/api/base44Client", () => ({
  base44: {
    entities: {
      Item: {
        filter: (...args) => filterItems(...args),
      },
    },
  },
}));

vi.mock("@/screens/items/useItemsController", () => ({
  useItemsController: (...args) => useItemsControllerMock(...args),
}));

vi.mock("@/components/common/PageScaffold", () => ({
  PageShell: ({ children }) => <div>{children}</div>,
  PageHeader: ({ titleNode, actions }) => (
    <header>
      <div>{titleNode}</div>
      <div>{actions}</div>
    </header>
  ),
}));

vi.mock("@/screens/items/ItemDetailPanel", () => ({
  __esModule: true,
  default: () => <div>Item detail panel</div>,
}));

vi.mock("@/components/common/ConfirmDialog", () => ({
  __esModule: true,
  default: ({ open, title, confirmLabel, onConfirm }) =>
    open ? (
      <div>
        <p>{title}</p>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

import WorkspaceItemView from "@/screens/items/WorkspaceItemView";

function makeController(overrides = {}) {
  return {
    loadingConfig: false,
    error: "",
    selectedItem: null,
    itemEngagement: { watched: false },
    savingItem: false,
    deletingItemId: null,
    hydrateItem: vi.fn((item) => item),
    setSelectedItem: vi.fn(),
    loadItemActivities: vi.fn(async () => {}),
    setError: vi.fn(),
    canDeleteItem: vi.fn(() => true),
    saveItem: vi.fn(async ({ payload }) => ({ ok: true, item: payload })),
    deleteItem: vi.fn(async () => ({ ok: true })),
    toggleItemWatch: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
}

const workspace = { id: "ws-1", slug: "acme" };

describe("WorkspaceItemView", () => {
  beforeEach(() => {
    navigate.mockReset();
    filterItems.mockReset();
    useItemsControllerMock.mockReset();
    filterItems.mockReturnValue(new Promise(() => {}));
  });

  test("renders loading skeleton while workspace item is unresolved", () => {
    const controller = makeController({ loadingConfig: true, selectedItem: null });
    useItemsControllerMock.mockReturnValue(controller);

    const { container } = render(
      <WorkspaceItemView
        workspace={workspace}
        role="owner"
        isPublicAccess={false}
        itemId="item-1"
      />,
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  test("shows not-found state when item query returns nothing", async () => {
    const controller = makeController({ selectedItem: null });
    useItemsControllerMock.mockReturnValue(controller);
    filterItems.mockResolvedValue([]);

    render(
      <WorkspaceItemView
        workspace={workspace}
        role="owner"
        isPublicAccess={false}
        itemId="missing"
      />,
    );

    expect(await screen.findByText("Unable to open item")).toBeInTheDocument();
    expect(screen.getByText("Item not found.")).toBeInTheDocument();
  });

  test("admin users can edit and save title", async () => {
    const item = {
      id: "item-2",
      group_key: "feedback",
      status_id: "status-open",
      item_type_id: "type-feature",
      assigned_to: null,
      title: "Original title",
      description: "desc",
      metadata: {},
      visibility: "public",
    };

    const controller = makeController({ selectedItem: item });
    useItemsControllerMock.mockReturnValue(controller);
    filterItems.mockResolvedValue([item]);

    render(
      <WorkspaceItemView
        workspace={workspace}
        role="owner"
        isPublicAccess={false}
        itemId="item-2"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit item title" }));
    fireEvent.change(screen.getByDisplayValue("Original title"), {
      target: { value: "Updated title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(controller.saveItem).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ title: "Updated title" }),
        }),
      );
    });
  });

  test("contributors cannot edit title or delete item", () => {
    const item = {
      id: "item-3",
      group_key: "feedback",
      title: "Contributor item",
    };

    const controller = makeController({ selectedItem: item, canDeleteItem: vi.fn(() => false) });
    useItemsControllerMock.mockReturnValue(controller);
    filterItems.mockResolvedValue([item]);

    render(
      <WorkspaceItemView
        workspace={workspace}
        role="contributor"
        isPublicAccess={false}
        itemId="item-3"
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit item title" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete item" })).not.toBeInTheDocument();
  });

  test("watch toggle and delete confirmation call controller actions", async () => {
    const item = {
      id: "item-4",
      group_key: "feedback",
      status_id: "status-open",
      item_type_id: "type-feature",
      title: "Delete me",
      description: "desc",
      metadata: {},
      visibility: "public",
    };

    const controller = makeController({ selectedItem: item, itemEngagement: { watched: true } });
    useItemsControllerMock.mockReturnValue(controller);
    filterItems.mockResolvedValue([item]);

    render(
      <WorkspaceItemView
        workspace={workspace}
        role="owner"
        isPublicAccess={false}
        itemId="item-4"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unwatch item" }));
    expect(controller.toggleItemWatch).toHaveBeenCalledWith("item-4");

    fireEvent.click(screen.getByRole("button", { name: "Delete item" }));
    expect(await screen.findByText("Delete this item?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete Item" }));

    await waitFor(() => {
      expect(controller.deleteItem).toHaveBeenCalledWith("item-4");
    });
    expect(navigate).toHaveBeenCalledWith("/workspace/acme/all");
  });
});
