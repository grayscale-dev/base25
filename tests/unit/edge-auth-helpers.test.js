const {
  getSupabaseClient,
  from,
  select,
  eq1,
  eq2,
  limit,
  maybeSingle,
  requestGetUser,
  adminGetUser,
  adminGetUserById,
} = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq1: vi.fn(),
  eq2: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
  requestGetUser: vi.fn(),
  adminGetUser: vi.fn(),
  adminGetUserById: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/supabase.ts", () => ({
  getSupabaseClient,
  supabaseAdmin: {
    from,
    auth: {
      getUser: adminGetUser,
      admin: {
        getUserById: adminGetUserById,
      },
    },
  },
}));

import {
  checkAuthentication,
  getUserWorkspaceRole,
  isAdminLikeRole,
  requireDisplayName,
  requireMinimumRole,
  requireOwner,
  verifyWorkspace,
} from "../../supabase/functions/_shared/authHelpers.ts";

describe("edge auth helpers", () => {
  beforeEach(() => {
    getSupabaseClient.mockReset();
    from.mockReset();
    select.mockReset();
    eq1.mockReset();
    eq2.mockReset();
    limit.mockReset();
    maybeSingle.mockReset();
    requestGetUser.mockReset();
    adminGetUser.mockReset();
    adminGetUserById.mockReset();

    getSupabaseClient.mockReturnValue({ auth: { getUser: requestGetUser } });

    from.mockReturnValue({ select });
    select.mockReturnValue({ eq: eq1 });
    eq1.mockReturnValue({ eq: eq2 });
    eq2.mockReturnValue({ limit });
    limit.mockReturnValue({ maybeSingle });
  });

  test("role and display-name helpers", async () => {
    expect(isAdminLikeRole("owner")).toBe(true);
    expect(isAdminLikeRole("admin")).toBe(true);
    expect(isAdminLikeRole("contributor")).toBe(false);

    expect(requireDisplayName({ first_name: "", last_name: "Lovelace" }).success).toBe(false);
    expect(requireDisplayName({ first_name: "Ada", last_name: "Lovelace" }).success).toBe(true);
  });

  test("checkAuthentication succeeds via request-scoped token lookup", async () => {
    requestGetUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "owner@example.com",
          user_metadata: { first_name: "Ada", last_name: "Lovelace" },
        },
      },
      error: null,
    });

    const req = new Request("https://example.com", {
      headers: { Authorization: "Bearer token-123" },
    });

    const result = await checkAuthentication(req);

    expect(result.authenticated).toBe(true);
    expect(result.user).toEqual(
      expect.objectContaining({ id: "u1", first_name: "Ada", last_name: "Lovelace" })
    );
  });

  test("checkAuthentication supports gateway-auth user fallback", async () => {
    requestGetUser.mockResolvedValue({ data: { user: null }, error: { message: "missing" } });
    adminGetUserById.mockResolvedValue({
      data: {
        user: {
          id: "u2",
          email: "admin@example.com",
          user_metadata: { full_name: "Grace Hopper" },
        },
      },
      error: null,
    });

    const req = new Request("https://example.com", {
      headers: { "x-supabase-auth-user": "u2" },
    });

    const result = await checkAuthentication(req);
    expect(result.authenticated).toBe(true);
    expect(result.user).toEqual(
      expect.objectContaining({ id: "u2", first_name: "Grace", last_name: "Hopper" })
    );
  });

  test("workspace role and minimum role checks", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { role: "contributor" }, error: null });
    expect(await getUserWorkspaceRole("w1", "u1")).toBe("contributor");

    maybeSingle.mockResolvedValueOnce({ data: { role: "contributor" }, error: null });
    const blocked = await requireMinimumRole("w1", "u1", "admin");
    expect(blocked.success).toBe(false);

    maybeSingle.mockResolvedValueOnce({ data: { role: "owner" }, error: null });
    const owner = await requireOwner("w1", "u1");
    expect(owner.success).toBe(true);
  });

  test("verifyWorkspace returns not found when no active workspace", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await verifyWorkspace("w1");
    expect(result.success).toBe(false);
  });
});
