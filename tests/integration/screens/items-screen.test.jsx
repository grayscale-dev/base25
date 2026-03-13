import React from "react";
import { render, screen } from "@testing-library/react";

const { useItemsController } = vi.hoisted(() => ({
  useItemsController: vi.fn(),
}));

vi.mock("@/screens/items/useItemsController", () => ({ useItemsController }));
vi.mock("@/screens/items/AllItemsPage", () => ({ default: () => <div>All Items View</div> }));
vi.mock("@/screens/items/GroupItemsPage", () => ({ default: ({ groupKey }) => <div>Group View: {groupKey}</div> }));

import Items from "@/screens/Items";

describe("Items screen routing logic", () => {
  beforeEach(() => {
    useItemsController.mockReturnValue({ items: [] });
  });

  test("shows unavailable state when workspace context missing", () => {
    render(<Items section="feedback" workspace={null} role="owner" isPublicAccess={false} />);
    expect(screen.getByText("Workspace unavailable")).toBeInTheDocument();
  });

  test("blocks non-admin from all section", () => {
    render(
      <Items
        section="all"
        workspace={{ id: "w1", slug: "acme" }}
        role="contributor"
        isPublicAccess={false}
      />
    );

    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  test("renders all section for admin users", () => {
    render(
      <Items
        section="all"
        workspace={{ id: "w1", slug: "acme" }}
        role="admin"
        isPublicAccess={false}
      />
    );

    expect(screen.getByText("All Items View")).toBeInTheDocument();
  });

  test("renders invalid section warning and group section otherwise", () => {
    const { rerender } = render(
      <Items
        section="invalid"
        workspace={{ id: "w1", slug: "acme" }}
        role="owner"
        isPublicAccess={false}
      />
    );
    expect(screen.getByText("Invalid section")).toBeInTheDocument();

    rerender(
      <Items
        section="roadmap"
        workspace={{ id: "w1", slug: "acme" }}
        role="owner"
        isPublicAccess={false}
      />
    );
    expect(screen.getByText("Group View: roadmap")).toBeInTheDocument();
  });
});
