import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { updateMe, uploadFile } = vi.hoisted(() => ({
  updateMe: vi.fn(),
  uploadFile: vi.fn(),
}));

vi.mock("@/api/base44Client", () => ({
  base44: {
    auth: {
      updateMe,
    },
    integrations: {
      Core: {
        UploadFile: uploadFile,
      },
    },
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }) => <section>{children}</section>,
  DialogHeader: ({ children }) => <header>{children}</header>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogDescription: ({ children }) => <p>{children}</p>,
}));

import ProfileCompletionModal from "@/components/auth/ProfileCompletionModal";

describe("ProfileCompletionModal", () => {
  beforeEach(() => {
    updateMe.mockReset();
    uploadFile.mockReset();
  });

  test("disables submit until required names are present", async () => {
    render(
      <ProfileCompletionModal
        isOpen
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        initialFirstName=""
        initialLastName=""
      />
    );

    expect(screen.getByRole("button", { name: "Save and Continue" })).toBeDisabled();
    expect(updateMe).not.toHaveBeenCalled();
  });

  test("submits profile updates and calls onComplete", async () => {
    const onComplete = vi.fn();
    updateMe.mockResolvedValue({});

    render(
      <ProfileCompletionModal
        isOpen
        onComplete={onComplete}
        onCancel={vi.fn()}
        initialFirstName="Ada"
        initialLastName="Lovelace"
      />
    );

    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: "Grace" },
    });
    fireEvent.change(screen.getByLabelText(/Last Name/i), {
      target: { value: "Hopper" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and Continue" }));

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: "Grace",
          last_name: "Hopper",
          full_name: "Grace Hopper",
        })
      );
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("supports explicit cancel action", () => {
    const onCancel = vi.fn();
    render(
      <ProfileCompletionModal
        isOpen
        onComplete={vi.fn()}
        onCancel={onCancel}
        allowCancel
        initialFirstName="Ada"
        initialLastName="Lovelace"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
