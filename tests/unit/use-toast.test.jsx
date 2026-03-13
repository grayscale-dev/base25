import { act, renderHook } from "@testing-library/react";
import { reducer, useToast } from "@/components/ui/use-toast";

describe("toast reducer", () => {
  test("adds and updates toasts", () => {
    const initial = { toasts: [] };
    const added = reducer(initial, {
      type: "ADD_TOAST",
      toast: { id: "1", title: "Saved", open: true },
    });
    expect(added.toasts).toHaveLength(1);

    const updated = reducer(added, {
      type: "UPDATE_TOAST",
      toast: { id: "1", title: "Updated" },
    });
    expect(updated.toasts[0].title).toBe("Updated");
  });

  test("dismiss marks toast closed", () => {
    const state = {
      toasts: [
        { id: "1", open: true },
        { id: "2", open: true },
      ],
    };
    const dismissed = reducer(state, { type: "DISMISS_TOAST", toastId: "1" });
    expect(dismissed.toasts.find((x) => x.id === "1").open).toBe(false);
    expect(dismissed.toasts.find((x) => x.id === "2").open).toBe(true);
  });
});

describe("useToast hook", () => {
  test("exposes toast + dismiss actions", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "hello" });
    });

    expect(result.current.toasts.length).toBeGreaterThan(0);

    const id = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(id);
    });

    expect(result.current.toasts.find((t) => t.id === id)?.open).toBe(false);
  });
});
