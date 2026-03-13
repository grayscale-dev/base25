import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ asChild, children }) => (asChild ? children : <button>{children}</button>),
  DropdownMenuContent: ({ children }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

import WorkspaceAvatar from "@/components/workspace/WorkspaceAvatar";
import WorkspaceCard from "@/components/workspace/WorkspaceCard";
import WorkspaceHeader from "@/components/workspace/WorkspaceHeader";

describe("workspace shared components", () => {
  test("WorkspaceAvatar renders fallback color and logo image", () => {
    const { container, rerender } = render(
      <WorkspaceAvatar workspace={{ name: "Acme", primary_color: "#004cff" }} size="sm" />
    );

    expect(screen.queryByRole("img", { name: "Acme" })).not.toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ backgroundColor: "#004cff" });

    rerender(
      <WorkspaceAvatar workspace={{ name: "Acme", logo_url: "https://img/logo.png" }} size="lg" />
    );

    expect(screen.getByRole("img", { name: "Acme" })).toHaveAttribute("src", "https://img/logo.png");
  });

  test("WorkspaceCard renders role/visibility and click action", () => {
    const onClick = vi.fn();
    render(
      <WorkspaceCard
        workspace={{ name: "Acme", description: "Product workspace", visibility: "public" }}
        role="owner"
        onClick={onClick}
      />
    );

    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Acme"));
    expect(onClick).toHaveBeenCalled();
  });

  test("WorkspaceHeader supports switching and settings affordance", () => {
    const onSwitch = vi.fn();
    render(
      <WorkspaceHeader
        workspace={{ id: "w1", name: "Acme", primary_color: "#004cff" }}
        workspaces={[
          { id: "w1", name: "Acme" },
          { id: "w2", name: "Beta" },
        ]}
        role="admin"
        onSwitch={onSwitch}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Beta/i }));
    expect(onSwitch).toHaveBeenCalledWith(expect.objectContaining({ id: "w2" }));
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/workspace-settings");
  });
});
