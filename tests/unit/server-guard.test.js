const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

const { getUser } = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser,
    },
  })),
}));

import { requireServerAuth } from "@/lib/auth/server-guard";

describe("requireServerAuth", () => {
  beforeEach(() => {
    redirect.mockReset();
    getUser.mockReset();
  });

  test("returns user when authenticated", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const user = await requireServerAuth("/alerts");
    expect(user).toEqual({ id: "u1" });
    expect(redirect).not.toHaveBeenCalled();
  });

  test("redirects to sign-in with encoded returnTo when missing user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await requireServerAuth("/workspace/acme/feedback");
    expect(redirect).toHaveBeenCalledWith(
      "/auth/sign-in?returnTo=%2Fworkspace%2Facme%2Ffeedback"
    );
  });
});
