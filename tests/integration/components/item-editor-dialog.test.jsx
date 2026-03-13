import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }) => <div>{children}</div>,
  DialogContent: ({ children }) => <section>{children}</section>,
  DialogHeader: ({ children }) => <header>{children}</header>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogDescription: ({ children }) => <p>{children}</p>,
  DialogFooter: ({ children }) => <footer>{children}</footer>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }) => <span>{placeholder || ""}</span>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ asChild, children }) => (asChild ? children : <button>{children}</button>),
  DropdownMenuContent: React.forwardRef(({ children }, ref) => {
    if (typeof ref === "function") {
      ref({ getElement: () => null });
    } else if (ref) {
      ref.current = { getElement: () => null };
    }
    return <div>{children}</div>;
  }),
  DropdownMenuItem: ({ children, onClick, disabled = false }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

import ItemEditorDialog from "@/screens/items/ItemEditorDialog";

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  onSave: vi.fn(),
  saving: false,
  item: null,
  availableGroupKeys: ["feedback", "roadmap"],
  availableStatusesByGroup: {
    feedback: [{ id: "s-feedback", label: "Open", group_key: "feedback" }],
    roadmap: [{ id: "s-roadmap", label: "Planned", group_key: "roadmap" }],
  },
  itemTypes: [{ id: "t-1", label: "Feature", is_active: true, display_order: 0 }],
  assigneeOptions: [
    {
      user_id: "u-1",
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
    },
  ],
  canAssign: true,
};

describe("ItemEditorDialog", () => {
  beforeEach(() => {
    baseProps.onSave.mockClear();
  });

  test("contributor submit mode only shows title and description", () => {
    render(
      <ItemEditorDialog
        {...baseProps}
        contributorFeedbackMode
      />
    );

    expect(screen.getByRole("heading", { name: "Submit feedback" })).toBeInTheDocument();
    expect(screen.queryByText("Group + Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Item Type")).not.toBeInTheDocument();
    expect(screen.queryByText("Assignee")).not.toBeInTheDocument();
  });

  test("contributor submit validates title and submits default payload", () => {
    render(
      <ItemEditorDialog
        {...baseProps}
        contributorFeedbackMode
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(baseProps.onSave).not.toHaveBeenCalled();

    const fields = screen.getAllByRole("textbox");
    fireEvent.change(fields[0], { target: { value: "Improve dashboard filtering" } });
    fireEvent.change(fields[1], { target: { value: "Filtering by assignee is required" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));

    expect(baseProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: null,
        status_id: "s-feedback",
        item_type_id: "t-1",
        assigned_to: null,
        title: "Improve dashboard filtering",
        description: "Filtering by assignee is required",
      })
    );
  });

  test("internal create mode exposes metadata and assignment controls", () => {
    render(<ItemEditorDialog {...baseProps} contributorFeedbackMode={false} />);
    expect(screen.getByRole("heading", { name: "Create item" })).toBeInTheDocument();
    expect(screen.getByText("Group + Status")).toBeInTheDocument();
    expect(screen.getByText("Item Type")).toBeInTheDocument();
    expect(screen.getByText("Assignee")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create item" })).toBeInTheDocument();
  });
});
