import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ItemDetailDrawer from "@/screens/items/ItemDetailDrawer";
import { makeItem } from "../../factories/entities";

vi.mock("@/components/ui/sheet", async () => {
  const React = await import("react");
  const Ctx = React.createContext(null);

  function Sheet({ open, onOpenChange, children }) {
    return <Ctx.Provider value={{ open, onOpenChange }}>{children}</Ctx.Provider>;
  }

  function SheetContent({ children }) {
    const ctx = React.useContext(Ctx);
    if (!ctx?.open) return null;
    return <aside>{children}</aside>;
  }

  return { Sheet, SheetContent };
});

vi.mock("@/screens/items/ItemDetailPanel", () => ({
  default: () => <div>Item detail panel</div>,
}));

vi.mock("@/components/common/ConfirmDialog", () => ({
  default: ({ open, title, confirmLabel, onConfirm, onOpenChange }) =>
    open ? (
      <div>
        <p>{title}</p>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close confirm
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

describe("ItemDetailDrawer", () => {
  const baseController = {
    setSelectedItem: vi.fn(),
    savingItem: false,
    deletingItemId: null,
    itemEngagement: { watched: false },
    setError: vi.fn(),
    canDeleteItem: vi.fn(() => true),
    saveItem: vi.fn(async ({ payload }) => ({ ok: true, item: { ...payload } })),
    loadItemActivities: vi.fn(async () => {}),
    deleteItem: vi.fn(async () => ({ ok: true })),
    toggleItemWatch: vi.fn(async () => ({ ok: true })),
  };

  beforeEach(() => {
    Object.values(baseController).forEach((value) => {
      if (typeof value === "function" && "mockClear" in value) {
        value.mockClear();
      }
    });
    baseController.itemEngagement = { watched: false };
  });

  test("renders title and closes drawer", () => {
    const onOpenChange = vi.fn();
    render(
      <ItemDetailDrawer
        open
        onOpenChange={onOpenChange}
        workspaceSlug="acme"
        controller={baseController}
        item={makeItem({ id: "item-1", title: "Improve retention insights" })}
        isAdmin={false}
      />
    );

    expect(screen.getByText("Improve retention insights")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close item details/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("admin can edit title and save", async () => {
    render(
      <ItemDetailDrawer
        open
        onOpenChange={vi.fn()}
        workspaceSlug="acme"
        controller={baseController}
        item={makeItem({
          id: "item-2",
          title: "Original title",
          status_id: "s1",
          item_type_id: "t1",
          metadata: {},
        })}
        isAdmin
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /edit item title/i }));
    const input = screen.getByDisplayValue("Original title");
    fireEvent.change(input, { target: { value: "Updated title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(baseController.saveItem).toHaveBeenCalled();
    });
    expect(baseController.saveItem).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          id: "item-2",
          title: "Updated title",
        }),
      })
    );
  });

  test("watch and delete actions call controller handlers", async () => {
    const onDeleted = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ItemDetailDrawer
        open
        onOpenChange={onOpenChange}
        workspaceSlug="acme"
        controller={baseController}
        item={makeItem({ id: "item-3", title: "Watch me" })}
        isAdmin
        onDeleted={onDeleted}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /watch item/i }));
    expect(baseController.toggleItemWatch).toHaveBeenCalledWith("item-3");

    fireEvent.click(screen.getByRole("button", { name: /delete item/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Item" }));

    await waitFor(() => {
      expect(baseController.deleteItem).toHaveBeenCalledWith("item-3");
    });
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
