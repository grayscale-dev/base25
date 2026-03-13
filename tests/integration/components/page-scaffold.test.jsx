import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PageHeader, PageShell } from "@/components/common/PageScaffold";

describe("PageScaffold primitives", () => {
  test("PageShell renders children and custom classes", () => {
    const { container } = render(
      <PageShell className="custom-shell">
        <div>Shell body</div>
      </PageShell>
    );

    expect(screen.getByText("Shell body")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("custom-shell");
  });

  test("PageHeader supports actions and titleNode", () => {
    const action = vi.fn();
    render(
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage this workspace"
        actions={<button onClick={action}>Save</button>}
      />
    );

    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(action).toHaveBeenCalled();
  });
});
