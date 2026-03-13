import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  navigate,
  getWorkspaceSession,
  consumeWorkspaceSettingsTabIntent,
  setWorkspaceSession,
  openStripeBilling,
  toast,
  base44,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  getWorkspaceSession: vi.fn(),
  consumeWorkspaceSettingsTabIntent: vi.fn(),
  setWorkspaceSession: vi.fn(),
  openStripeBilling: vi.fn(),
  toast: vi.fn(),
  base44: {
    functions: {
      invoke: vi.fn(),
    },
    entities: {
      Workspace: { filter: vi.fn() },
      ItemStatusGroup: { create: vi.fn() },
      ItemStatus: { create: vi.fn() },
    },
    integrations: {
      Core: {
        UploadFile: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/api/base44Client", () => ({ base44 }));
vi.mock("@/lib/workspace-session", () => ({
  getWorkspaceSession,
  consumeWorkspaceSettingsTabIntent,
  setWorkspaceSession,
}));
vi.mock("@/lib/openStripeBilling", () => ({ openStripeBilling }));

vi.mock("@/components/workspace/AccountSettingsPanel", () => ({
  default: ({ onStatusChange }) => (
    <div>
      <p>Account panel</p>
      <button
        type="button"
        onClick={() => onStatusChange?.({ tone: "success", message: "Account saved." })}
      >
        Trigger account status
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }) => <div>{children}</div>,
  Droppable: ({ children, droppableId }) =>
    children(
      {
        innerRef: () => {},
        droppableProps: { "data-droppable-id": droppableId },
      },
      { isDraggingOver: false }
    ),
  Draggable: ({ children, draggableId }) =>
    children(
      {
        innerRef: () => {},
        draggableProps: { "data-draggable-id": draggableId },
        dragHandleProps: { role: "button" },
      },
      { isDragging: false }
    ),
}));

import WorkspaceSettings from "@/screens/WorkspaceSettings";

function workspaceSession(overrides = {}) {
  return {
    workspace: {
      id: "ws-1",
      slug: "acme",
      name: "Acme",
      description: "Workspace",
      visibility: "restricted",
      settings: {},
      logo_url: "",
      primary_color: "#0f172a",
    },
    role: "owner",
    ...overrides,
  };
}

function mockAdminData() {
  base44.functions.invoke.mockImplementation(async (fn) => {
    if (fn === "listWorkspaceMembers") {
      return {
        data: {
          members: [
            {
              id: "m1",
              user_id: "u1",
              role: "owner",
              email: "owner@example.com",
              first_name: "Owner",
              last_name: "One",
            },
          ],
        },
      };
    }
    if (fn === "getWorkspaceAccessCodeStatus") {
      return {
        data: {
          has_code: true,
          masked_code: "ABCD****",
          access_code: null,
          created_at: "2026-03-10T12:00:00.000Z",
        },
      };
    }
    if (fn === "getItemStatusConfig") {
      return {
        data: {
          groups: [
            {
              id: "g-feedback",
              group_key: "feedback",
              display_name: "Feedback",
              color_hex: "#123456",
              display_order: 0,
            },
          ],
          statuses: [
            {
              id: "s-feedback-open",
              group_key: "feedback",
              label: "Open",
              display_order: 0,
              is_active: true,
            },
          ],
        },
      };
    }
    if (fn === "listItemTypes") {
      return {
        data: {
          item_types: [
            { id: "type-1", label: "Feature", display_order: 0, is_active: true },
          ],
        },
      };
    }
    return { data: {} };
  });
}

describe("WorkspaceSettings screen", () => {
  beforeEach(() => {
    navigate.mockReset();
    getWorkspaceSession.mockReset();
    consumeWorkspaceSettingsTabIntent.mockReset();
    setWorkspaceSession.mockReset();
    openStripeBilling.mockReset();
    toast.mockReset();
    base44.functions.invoke.mockReset();
    base44.entities.Workspace.filter.mockReset();
    base44.entities.ItemStatusGroup.create.mockReset();
    base44.entities.ItemStatus.create.mockReset();
    base44.integrations.Core.UploadFile.mockReset();

    consumeWorkspaceSettingsTabIntent.mockReturnValue(null);
    getWorkspaceSession.mockReturnValue(workspaceSession());
    openStripeBilling.mockResolvedValue({ ok: true });
    mockAdminData();
  });

  test("redirects to workspaces when session has no workspace", async () => {
    getWorkspaceSession.mockReturnValueOnce({ workspace: null, role: "contributor" });

    render(<WorkspaceSettings />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/workspaces");
    });
  });

  test("renders contributor simplified settings view", async () => {
    getWorkspaceSession.mockReturnValueOnce(
      workspaceSession({ role: "contributor" })
    );

    render(<WorkspaceSettings />);

    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Account panel")).toBeInTheDocument();
    expect(screen.queryByText("Workspace Settings")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "General" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Trigger account status" }));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Account saved.", variant: "success" })
    );
  });

  test("renders admin/owner workspace tabs and opens billing", async () => {
    render(<WorkspaceSettings />);

    expect(await screen.findByText("Workspace Settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Access" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Billing" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Billing" }));

    await waitFor(() => {
      expect(openStripeBilling).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "ws-1" })
      );
    });
  });

  test("allows opening destructive workspace delete dialog", async () => {
    render(<WorkspaceSettings />);

    await screen.findByText("Workspace Settings");
    fireEvent.click(screen.getByRole("button", { name: "Delete Workspace" }));
    expect(await screen.findByText("This archives the workspace and removes access for everyone. This action cannot be undone.")).toBeInTheDocument();
  });

  test("rotates workspace code from access settings dialog", async () => {
    const priorInvoke = base44.functions.invoke.getMockImplementation();
    base44.functions.invoke.mockImplementation(async (fn, payload, opts) => {
      if (fn === "setWorkspaceAccessCode") {
        return {
          data: {
            masked_code: "ZXCV****",
            access_code: "ZXCVBN12",
            rotated_at: "2026-03-12T00:00:00.000Z",
          },
        };
      }
      return priorInvoke ? priorInvoke(fn, payload, opts) : { data: {} };
    });

    render(<WorkspaceSettings />);

    await screen.findByText("Workspace Settings");
    fireEvent.click(screen.getByRole("button", { name: "Access" }));
    fireEvent.click(screen.getByRole("button", { name: "Rotate" }));
    expect(await screen.findByText("Rotate Workspace Code")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rotate Code" }));

    await waitFor(() => {
      expect(base44.functions.invoke).toHaveBeenCalledWith(
        "setWorkspaceAccessCode",
        { workspace_id: "ws-1", action: "rotate" },
        { authMode: "user" }
      );
    });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Workspace code rotated. The previous code is no longer valid.",
        variant: "success",
      })
    );
  });

  test("status group delete is disabled when it is the only status", async () => {
    render(<WorkspaceSettings />);

    await screen.findByText("Workspace Settings");
    fireEvent.click(screen.getByRole("button", { name: "Status Groups" }));

    const deleteButtons = await screen.findAllByRole("button", { name: "Delete status" });
    expect(deleteButtons[0]).toBeDisabled();
  });

  test("adds a status from the status groups dialog", async () => {
    const priorInvoke = base44.functions.invoke.getMockImplementation();
    base44.functions.invoke.mockImplementation(async (fn, payload, opts) => {
      if (fn === "upsertItemStatus") {
        return {
          data: {
            id: "s-feedback-next",
            group_key: "feedback",
            label: payload.label,
            display_order: 1,
            is_active: true,
          },
        };
      }
      return priorInvoke ? priorInvoke(fn, payload, opts) : { data: {} };
    });

    render(<WorkspaceSettings />);

    await screen.findByText("Workspace Settings");
    fireEvent.click(screen.getByRole("button", { name: "Status Groups" }));

    fireEvent.click(screen.getAllByRole("button", { name: "Add Status" })[0]);
    expect(await screen.findByPlaceholderText("Enter status name")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Enter status name"), {
      target: { value: "Investigating" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Add Status" }).at(-1));

    await waitFor(() => {
      expect(base44.functions.invoke).toHaveBeenCalledWith(
        "upsertItemStatus",
        expect.objectContaining({
          workspace_id: "ws-1",
          group_key: "feedback",
          label: "Investigating",
        }),
        { authMode: "user" }
      );
    });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Status added.",
        variant: "success",
      })
    );
  });
});
