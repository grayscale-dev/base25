const {
  checkAuthentication,
  getUserWorkspaceRole,
  verifyWorkspace,
  getWorkspaceBillingAccessState,
  from,
  select,
  eqSlug,
  eqStatus,
  limit,
  maybeSingle,
} = vi.hoisted(() => ({
  checkAuthentication: vi.fn(),
  getUserWorkspaceRole: vi.fn(),
  verifyWorkspace: vi.fn(),
  getWorkspaceBillingAccessState: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eqSlug: vi.fn(),
  eqStatus: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/authHelpers.ts", () => ({
  checkAuthentication,
  getUserWorkspaceRole,
  verifyWorkspace,
}));

vi.mock("../../supabase/functions/_shared/billing.ts", () => ({
  getWorkspaceBillingAccessState,
}));

vi.mock("../../supabase/functions/_shared/supabase.ts", () => ({
  supabaseAdmin: { from },
}));

import {
  requireWorkspaceReadAccess,
  resolveWorkspaceFromPayload,
} from "../../supabase/functions/_shared/itemAccess.ts";

describe("edge shared item read access", () => {
  const request = new Request("https://example.com");

  beforeEach(() => {
    checkAuthentication.mockReset();
    getUserWorkspaceRole.mockReset();
    verifyWorkspace.mockReset();
    getWorkspaceBillingAccessState.mockReset();

    from.mockReset();
    select.mockReset();
    eqSlug.mockReset();
    eqStatus.mockReset();
    limit.mockReset();
    maybeSingle.mockReset();

    from.mockReturnValue({ select });
    select.mockReturnValue({ eq: eqSlug });
    eqSlug.mockReturnValue({ eq: eqStatus });
    eqStatus.mockReturnValue({ limit });
    limit.mockReturnValue({ maybeSingle });

    verifyWorkspace.mockResolvedValue({
      success: true,
      workspace: { id: "w1", slug: "acme", visibility: "restricted" },
      error: null,
    });
    checkAuthentication.mockResolvedValue({ authenticated: true, user: { id: "u1" } });
    getUserWorkspaceRole.mockResolvedValue("contributor");
    getWorkspaceBillingAccessState.mockResolvedValue({ status: "active", accessAllowed: true });
  });

  test("resolveWorkspaceFromPayload returns validation error without id or slug", async () => {
    const result = await resolveWorkspaceFromPayload({});
    expect(result.error).toMatch(/workspace_id or slug/i);
  });

  test("resolveWorkspaceFromPayload resolves slug to workspace id", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "w2", slug: "demo" }, error: null });
    const result = await resolveWorkspaceFromPayload({ slug: "demo" });
    expect(result.workspaceId).toBe("w2");
  });

  test("allows public workspace read access for unauthenticated users", async () => {
    verifyWorkspace.mockResolvedValue({
      success: true,
      workspace: { id: "w1", slug: "acme", visibility: "public" },
      error: null,
    });
    checkAuthentication.mockResolvedValue({ authenticated: false, user: null });

    const result = await requireWorkspaceReadAccess(request, { workspace_id: "w1" });

    expect(result.success).toBe(true);
    expect(result.isPublicAccess).toBe(true);
    expect(result.user).toBeNull();
  });

  test("blocks restricted workspace without authentication", async () => {
    checkAuthentication.mockResolvedValue({ authenticated: false, user: null });

    const result = await requireWorkspaceReadAccess(request, { workspace_id: "w1" });

    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
  });

  test("blocks members when billing is inactive", async () => {
    getWorkspaceBillingAccessState.mockResolvedValue({ status: "inactive", accessAllowed: false });

    const result = await requireWorkspaceReadAccess(request, { workspace_id: "w1" });

    expect(result.success).toBe(false);
    expect(result.status).toBe(402);
    expect(result.billing).toEqual({ status: "inactive", access_allowed: false });
  });

  test("returns success with role and billing metadata", async () => {
    const result = await requireWorkspaceReadAccess(request, { workspace_id: "w1" });

    expect(result.success).toBe(true);
    expect(result.role).toBe("contributor");
    expect(result.billing).toEqual({ status: "active", access_allowed: true });
  });
});
