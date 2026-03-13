import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }) => <div>{children}</div>,
  DialogContent: ({ children }) => <section>{children}</section>,
  DialogHeader: ({ children }) => <header>{children}</header>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogFooter: ({ children }) => <footer>{children}</footer>,
}));

import ConfirmDialog from "@/components/common/ConfirmDialog";

describe("ConfirmDialog", () => {
  test("fires cancel and confirm actions", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete workspace?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("loading state disables actions", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete item?"
        confirmLabel="Deleting..."
        onConfirm={vi.fn()}
        loading
      />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
  });
});
