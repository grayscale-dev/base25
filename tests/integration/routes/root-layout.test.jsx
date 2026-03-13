import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/AppProviders", () => ({
  default: ({ children }) => <div data-testid="providers">{children}</div>,
}));

describe("root layout", () => {
  test("exports site metadata and wraps children", async () => {
    const mod = await import("../../../app/layout.jsx");
    const RootLayout = mod.default;

    expect(mod.metadata.title).toBe("Base25");
    expect(String(mod.metadata.metadataBase)).toContain("base25");

    render(
      <RootLayout>
        <main>App body</main>
      </RootLayout>
    );

    expect(screen.getByTestId("providers")).toBeInTheDocument();
    expect(screen.getByText("App body")).toBeInTheDocument();
  });
});
