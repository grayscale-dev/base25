import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  me,
  updateMe,
  logout,
  invoke,
  uploadFile,
} = vi.hoisted(() => ({
  me: vi.fn(),
  updateMe: vi.fn(),
  logout: vi.fn(),
  invoke: vi.fn(),
  uploadFile: vi.fn(),
}));

vi.mock("@/api/base44Client", () => ({
  base44: {
    auth: {
      me,
      updateMe,
      logout,
    },
    functions: {
      invoke,
    },
    integrations: {
      Core: {
        UploadFile: uploadFile,
      },
    },
  },
}));

vi.mock("@/components/common/ConfirmDialog", () => ({
  default: ({ open, title, confirmLabel, onConfirm, onOpenChange }) =>
    open ? (
      <div>
        <p>{title}</p>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

import AccountSettingsPanel from "@/components/workspace/AccountSettingsPanel";

describe("AccountSettingsPanel", () => {
  beforeEach(() => {
    me.mockReset();
    updateMe.mockReset();
    logout.mockReset();
    invoke.mockReset();
    uploadFile.mockReset();

    me.mockResolvedValue({
      id: "u1",
      email: "owner@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
      profile_photo_url: "",
    });
    updateMe.mockResolvedValue({
      id: "u1",
      email: "owner@example.com",
      first_name: "Grace",
      last_name: "Hopper",
      full_name: "Grace Hopper",
      profile_photo_url: "",
    });
    logout.mockResolvedValue({});
    invoke.mockResolvedValue({});
  });

  test("renders account info after load and saves profile", async () => {
    const onStatusChange = vi.fn();
    render(<AccountSettingsPanel onStatusChange={onStatusChange} />);

    expect(await screen.findByText("My Account")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("First name"), { target: { value: "Grace" } });
    fireEvent.change(screen.getByPlaceholderText("Last name"), { target: { value: "Hopper" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Profile/i }));

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith(
        expect.objectContaining({ first_name: "Grace", last_name: "Hopper" })
      );
    });

    expect(onStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "success" })
    );
  });

  test("shows retry panel when load fails", async () => {
    me.mockRejectedValue(new Error("boom"));

    render(<AccountSettingsPanel onStatusChange={vi.fn()} />);

    expect(await screen.findByText("Account settings unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  test("supports sign out and account deletion", async () => {
    const onStatusChange = vi.fn();
    render(<AccountSettingsPanel onStatusChange={onStatusChange} />);

    expect(await screen.findByText("Danger Zone")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sign Out/i }));
    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Delete Account/i })[0]);
    expect(screen.getAllByText("Delete Account").length).toBeGreaterThan(1);

    fireEvent.click(screen.getAllByRole("button", { name: "Delete Account" }).at(-1));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("deleteMyAccount", {});
    });
  });
});
