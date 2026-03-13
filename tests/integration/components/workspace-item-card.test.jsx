import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import WorkspaceItemCard from "@/components/workspace/WorkspaceItemCard";
import { makeItem } from "../../factories/entities";

describe("WorkspaceItemCard", () => {
  test("shows assignee metadata for admin/owner but hides it for contributor", () => {
    const item = makeItem({
      title: "Improve search relevance",
      assigned_to: "user-1",
    });
    const assigneeDirectoryById = new Map([
      [
        "user-1",
        {
          user_id: "user-1",
          display_name: "Ada Lovelace",
          email: "ada@example.com",
        },
      ],
    ]);

    const { rerender } = render(
      <WorkspaceItemCard
        item={item}
        role="owner"
        assigneeDirectoryById={assigneeDirectoryById}
      />
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();

    rerender(
      <WorkspaceItemCard
        item={item}
        role="contributor"
        assigneeDirectoryById={assigneeDirectoryById}
      />
    );
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  test("opens item on card click and enter key", () => {
    const onOpen = vi.fn();
    const item = makeItem({ title: "Shipping velocity dashboard" });
    render(<WorkspaceItemCard item={item} onOpen={onOpen} />);

    const card = screen.getByRole("button");
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });

    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenCalledWith(item);
  });

  test("watch bell toggle is isolated from card open", () => {
    const onOpen = vi.fn();
    const onToggleWatch = vi.fn();
    const item = makeItem({ watched: true });
    render(<WorkspaceItemCard item={item} onOpen={onOpen} onToggleWatch={onToggleWatch} />);

    fireEvent.click(screen.getByRole("button", { name: /disable alerts for item/i }));
    expect(onToggleWatch).toHaveBeenCalledWith(item);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("renders search match context labels", () => {
    const item = makeItem({
      match_preview: "customer asked for a bug fix in comments",
    });

    render(
      <WorkspaceItemCard
        item={item}
        matchContext={["description", "comment_text"]}
        contextText="Search result"
      />
    );

    expect(screen.getByText("Search result")).toBeInTheDocument();
    expect(screen.getByText(/Matched in: Description, Comment Text/)).toBeInTheDocument();
  });
});
