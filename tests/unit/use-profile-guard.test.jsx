import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useProfileGuard } from "@/components/auth/useProfileGuard";

const refresh = vi.fn();

vi.mock("@/components/context/WorkspaceContext", () => ({
  useWorkspaceContext: vi.fn(() => ({
    user: { id: "u1", first_name: "", last_name: "", email: "a@b.com" },
    refresh,
  })),
}));

describe("useProfileGuard", () => {
  test("blocks action when profile incomplete until completion", async () => {
    const { result } = renderHook(() => useProfileGuard());
    const action = vi.fn().mockResolvedValue("ok");

    let guardedPromise;
    await act(async () => {
      guardedPromise = result.current.guardAction(action);
    });

    expect(action).not.toHaveBeenCalled();
    expect(result.current.ProfileGuard).toBeTypeOf("function");

    await waitFor(() => {
      expect(result.current.ProfileGuard().props.isOpen).toBe(true);
    });

    await act(async () => {
      await result.current.ProfileGuard().props.onComplete();
    });

    await guardedPromise;
    expect(refresh).toHaveBeenCalled();
    expect(action).toHaveBeenCalled();
  });
});
