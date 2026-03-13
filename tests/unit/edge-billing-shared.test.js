const { from, select, eq, maybeSingle } = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/supabase.ts", () => ({
  supabaseAdmin: { from },
}));

import {
  BILLING_ALLOWED_STATUSES,
  getWorkspaceBillingAccessState,
  isBillingAccessAllowed,
} from "../../supabase/functions/_shared/billing.ts";

describe("edge shared billing helpers", () => {
  beforeEach(() => {
    from.mockReset();
    select.mockReset();
    eq.mockReset();
    maybeSingle.mockReset();

    from.mockReturnValue({ select });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ maybeSingle });
  });

  test("recognizes allowed statuses", () => {
    expect(BILLING_ALLOWED_STATUSES).toEqual(["active", "trialing"]);
    expect(isBillingAccessAllowed("active")).toBe(true);
    expect(isBillingAccessAllowed("trialing")).toBe(true);
    expect(isBillingAccessAllowed("inactive")).toBe(false);
    expect(isBillingAccessAllowed(null)).toBe(false);
  });

  test("returns allowed state when lookup finds active status", async () => {
    maybeSingle.mockResolvedValue({ data: { status: "ACTIVE" }, error: null });

    const result = await getWorkspaceBillingAccessState("w1");

    expect(from).toHaveBeenCalledWith("billing_customers");
    expect(result).toEqual({ status: "active", accessAllowed: true });
  });

  test("returns inactive on lookup error", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await getWorkspaceBillingAccessState("w2");

    expect(result).toEqual({ status: "inactive", accessAllowed: false });
  });
});
