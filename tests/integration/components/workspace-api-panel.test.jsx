import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const filterTokens = vi.fn();
const invokeFunction = vi.fn();

vi.mock("@/api/base44Client", () => ({
  base44: {
    auth: {
      me: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
    },
    entities: {
      ApiToken: {
        filter: (...args) => filterTokens(...args),
        create: vi.fn().mockResolvedValue({}),
      },
    },
    functions: {
      invoke: (...args) => invokeFunction(...args),
    },
  },
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }) => <section>{children}</section>,
  DialogHeader: ({ children }) => <header>{children}</header>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogFooter: ({ children }) => <footer>{children}</footer>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }) => <div>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <h3>{children}</h3>,
  CardDescription: ({ children }) => <p>{children}</p>,
  CardContent: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }) => <table>{children}</table>,
  TableHeader: ({ children }) => <thead>{children}</thead>,
  TableBody: ({ children }) => <tbody>{children}</tbody>,
  TableRow: ({ children }) => <tr>{children}</tr>,
  TableHead: ({ children }) => <th>{children}</th>,
  TableCell: ({ children }) => <td>{children}</td>,
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }) => <div>{children}</div>,
  CollapsibleTrigger: ({ asChild, children }) => (asChild ? children : <button>{children}</button>),
  CollapsibleContent: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => onCheckedChange?.(!checked)}
    />
  ),
}));

vi.mock("@/components/common/ConfirmDialog", () => ({
  default: ({ open, title }) => (open ? <div>{title}</div> : null),
}));

import WorkspaceApiPanel from "@/components/workspace/WorkspaceApiPanel";

describe("WorkspaceApiPanel (inactive route isolation)", () => {
  beforeEach(() => {
    filterTokens.mockReset();
    invokeFunction.mockReset();
  });

  test("owner can open create token dialog and see revoke confirmation affordance", async () => {
    filterTokens.mockResolvedValue([
      {
        id: "token-1",
        name: "CI Token",
        token_prefix: "itms_1234",
        permissions: ["items:read"],
        created_date: "2026-03-01T00:00:00.000Z",
      },
    ]);

    render(
      <WorkspaceApiPanel
        workspace={{ id: "ws-1" }}
        role="owner"
      />
    );

    await screen.findByText("CI Token");
    fireEvent.click(screen.getByRole("button", { name: /create token/i }));
    expect(screen.getByText("Create API Token")).toBeInTheDocument();

    const row = screen.getByText("CI Token").closest("tr");
    const buttons = within(row).getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(screen.getByText("Revoke API Token")).toBeInTheDocument();
  });

  test("contributors cannot revoke API keys", async () => {
    filterTokens.mockResolvedValue([
      {
        id: "token-2",
        name: "Readonly Token",
        token_prefix: "itms_abcd",
        permissions: ["items:read"],
        created_date: "2026-03-01T00:00:00.000Z",
      },
    ]);

    render(
      <WorkspaceApiPanel
        workspace={{ id: "ws-1" }}
        role="contributor"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Readonly Token")).toBeInTheDocument();
    });
    const row = screen.getByText("Readonly Token").closest("tr");
    const revokeButton = within(row).getAllByRole("button")[0];
    expect(revokeButton).toBeDisabled();
  });
});
