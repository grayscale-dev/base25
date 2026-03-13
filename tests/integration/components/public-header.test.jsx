import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

const { startWorkspaceLogin } = vi.hoisted(() => ({
  startWorkspaceLogin: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/start-workspace-login", () => ({
  startWorkspaceLogin,
}));

vi.mock("@/components/ui/sheet", async () => {
  const React = await import("react");
  const Ctx = React.createContext(null);

  function Sheet({ open, defaultOpen = false, onOpenChange, children }) {
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const controlled = open !== undefined;
    const currentOpen = controlled ? open : internalOpen;
    const setOpen = (next) => {
      if (!controlled) setInternalOpen(next);
      onOpenChange?.(next);
    };
    return <Ctx.Provider value={{ open: currentOpen, setOpen }}>{children}</Ctx.Provider>;
  }

  function SheetTrigger({ asChild, children }) {
    const ctx = React.useContext(Ctx);
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        "data-testid": "public-mobile-trigger",
        onClick: (event) => {
          children.props?.onClick?.(event);
          ctx.setOpen(true);
        },
      });
    }
    return <button onClick={() => ctx.setOpen(true)}>{children}</button>;
  }

  function SheetContent({ children }) {
    const ctx = React.useContext(Ctx);
    if (!ctx?.open) return null;
    return <div data-testid="sheet-content">{children}</div>;
  }

  return { Sheet, SheetTrigger, SheetContent };
});

import PublicHeader from "@/components/common/PublicHeader";

describe("PublicHeader", () => {
  beforeEach(() => {
    startWorkspaceLogin.mockClear();
  });

  test("desktop get started calls workspace login", async () => {
    render(<PublicHeader currentPage="home" />);
    fireEvent.click(screen.getAllByRole("button", { name: /get started/i })[0]);
    expect(startWorkspaceLogin).toHaveBeenCalledTimes(1);
  });

  test("mobile sheet opens and link click closes menu", () => {
    render(<PublicHeader currentPage="features" />);

    fireEvent.click(screen.getByTestId("public-mobile-trigger"));
    expect(screen.getByTestId("sheet-content")).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByTestId("sheet-content")).getByRole("link", { name: "About" })
    );

    expect(screen.queryByTestId("sheet-content")).not.toBeInTheDocument();
  });

  test("mobile get started also triggers workspace login", async () => {
    render(<PublicHeader currentPage="pricing" />);
    fireEvent.click(screen.getByTestId("public-mobile-trigger"));
    fireEvent.click(
      within(screen.getByTestId("sheet-content")).getByRole("button", {
        name: /get started/i,
      })
    );
    expect(startWorkspaceLogin).toHaveBeenCalledTimes(1);
  });
});
