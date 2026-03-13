import React from "react";
import { render, screen } from "@testing-library/react";

const requireServerAuth = vi.fn(async () => ({}));
const notFound = vi.fn();

vi.mock("@/lib/auth/server-guard", () => ({ requireServerAuth }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/components/RoutePage", () => ({
  default: ({ currentPageName, children }) => (
    <div>
      <span data-testid="route-page-name">{currentPageName}</span>
      {children}
    </div>
  ),
}));
vi.mock("@/screens/Workspace", () => ({
  default: ({ section, itemId }) => (
    <div>
      Workspace Screen [{section}] {itemId ? `(item:${itemId})` : ""}
    </div>
  ),
}));

describe("workspace dynamic routes", () => {
  beforeEach(() => {
    requireServerAuth.mockClear();
    notFound.mockClear();
  });

  test("workspace section page renders valid section", async () => {
    const WorkspaceSectionPage = (await import("../../../app/workspace/[slug]/[section]/page.jsx")).default;

    const element = await WorkspaceSectionPage({
      params: Promise.resolve({ slug: "acme", section: "feedback" }),
    });
    render(element);

    expect(requireServerAuth).toHaveBeenCalledWith("/workspace/acme/feedback");
    expect(screen.getByTestId("route-page-name")).toHaveTextContent("Feedback");
    expect(screen.getByText(/Workspace Screen \[feedback\]/)).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  test("workspace section page rejects invalid sections", async () => {
    const WorkspaceSectionPage = (await import("../../../app/workspace/[slug]/[section]/page.jsx")).default;

    await WorkspaceSectionPage({
      params: Promise.resolve({ slug: "acme", section: "invalid" }),
    });

    expect(notFound).toHaveBeenCalled();
  });

  test("workspace section page supports alias items", async () => {
    const WorkspaceSectionPage = (await import("../../../app/workspace/[slug]/[section]/page.jsx")).default;

    const element = await WorkspaceSectionPage({
      params: Promise.resolve({ slug: "acme", section: "items" }),
    });
    render(element);

    expect(screen.getByTestId("route-page-name")).toHaveTextContent("Items");
    expect(screen.getByText(/Workspace Screen \[items\]/)).toBeInTheDocument();
  });

  test("workspace item page calls auth and passes item id", async () => {
    const WorkspaceItemPage = (await import("../../../app/workspace/[slug]/item/[itemId]/page.jsx")).default;

    const element = await WorkspaceItemPage({
      params: Promise.resolve({ slug: "acme", itemId: "it-1" }),
    });
    render(element);

    expect(requireServerAuth).toHaveBeenCalledWith("/workspace/acme/item/it-1");
    expect(screen.getByTestId("route-page-name")).toHaveTextContent("Item");
    expect(screen.getByText(/item:it-1/)).toBeInTheDocument();
  });
});
