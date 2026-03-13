import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/common/PageLoadingState", () => ({
  default: ({ text }) => <div>Loading State: {text}</div>,
}));

vi.mock("@/lib/PageNotFound", () => ({
  default: () => <div>Custom Not Found</div>,
}));

describe("boundary and utility route files", () => {
  test("app loading page renders", async () => {
    const Loading = (await import("../../../app/loading.jsx")).default;
    render(<Loading />);
    expect(screen.getByText("Loading State: Loading...")).toBeInTheDocument();
  });

  test("workspace section loading page uses workspace loading copy", async () => {
    const WorkspaceLoading = (await import("../../../app/workspace/[slug]/[section]/loading.jsx")).default;
    render(<WorkspaceLoading />);
    expect(screen.getByText("Loading State: Loading workspace...")).toBeInTheDocument();
  });

  test("not-found page renders custom component", async () => {
    const NotFound = (await import("../../../app/not-found.jsx")).default;
    render(<NotFound />);
    expect(screen.getByText("Custom Not Found")).toBeInTheDocument();
  });

  test("route error page supports retry", async () => {
    const ErrorPage = (await import("../../../app/error.jsx")).default;
    const reset = vi.fn();
    render(<ErrorPage error={new Error("Boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(reset).toHaveBeenCalled();
  });

  test("global error page supports retry and reload", async () => {
    const GlobalError = (await import("../../../app/global-error.jsx")).default;
    const reset = vi.fn();
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });

    render(<GlobalError error={new Error("Boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));

    expect(reset).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  test("workspace section error page supports retry", async () => {
    const WorkspaceError = (await import("../../../app/workspace/[slug]/[section]/error.jsx")).default;
    const reset = vi.fn();
    render(<WorkspaceError error={{ message: "Broken" }} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalled();
  });
});
