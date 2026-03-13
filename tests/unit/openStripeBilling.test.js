import { openStripeBilling } from "@/lib/openStripeBilling";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@/api/base44Client", () => ({
  base44: {
    functions: {
      invoke,
    },
  },
}));

describe("openStripeBilling", () => {
  beforeEach(() => {
    invoke.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "https://base25.app/workspace/acme/feedback" },
    });
  });

  test("returns validation error for missing workspace id", async () => {
    const result = await openStripeBilling({ workspaceId: "", returnUrl: "https://base25.app" });
    expect(result).toEqual({ ok: false, error: "Workspace is missing." });
  });

  test("uses billing portal when available", async () => {
    invoke.mockResolvedValueOnce({ data: { url: "https://stripe.test/portal" } });

    const result = await openStripeBilling({ workspaceId: "w1", returnUrl: "https://base25.app/return" });

    expect(invoke).toHaveBeenCalledWith(
      "createBillingPortal",
      expect.objectContaining({ workspace_id: "w1" }),
      { authMode: "user" }
    );
    expect(window.location.href).toBe("https://stripe.test/portal");
    expect(result).toEqual({ ok: true, destination: "portal" });
  });

  test("falls back to checkout on missing customer portal errors", async () => {
    invoke
      .mockRejectedValueOnce({ status: 404, message: "No billing customer found" })
      .mockResolvedValueOnce({ data: { url: "https://stripe.test/checkout" } });

    const result = await openStripeBilling({ workspaceId: "w1", returnUrl: "https://base25.app/return" });

    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "createCheckoutSession",
      expect.objectContaining({ workspace_id: "w1" }),
      { authMode: "user" }
    );
    expect(window.location.href).toBe("https://stripe.test/checkout");
    expect(result).toEqual({ ok: true, destination: "checkout" });
  });

  test("retries checkout with force_new_customer when customer missing", async () => {
    invoke
      .mockRejectedValueOnce({ status: 404, message: "No billing customer found" })
      .mockRejectedValueOnce({ status: 500, message: "No such customer" })
      .mockResolvedValueOnce({ data: { url: "https://stripe.test/checkout-2" } });

    const result = await openStripeBilling({ workspaceId: "w1", returnUrl: "https://base25.app/return" });

    expect(invoke).toHaveBeenNthCalledWith(
      3,
      "createCheckoutSession",
      expect.objectContaining({ force_new_customer: true }),
      { authMode: "user" }
    );
    expect(result).toEqual({ ok: true, destination: "checkout" });
  });

  test("returns checkout error when both attempts fail", async () => {
    invoke
      .mockRejectedValueOnce({ status: 404, message: "No billing customer found" })
      .mockRejectedValueOnce({ status: 500, message: "No such customer" })
      .mockRejectedValueOnce({ status: 500, message: "still bad" });

    const result = await openStripeBilling({ workspaceId: "w1", returnUrl: "https://base25.app/return" });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/still bad|Unable to open Stripe checkout/);
  });
});
