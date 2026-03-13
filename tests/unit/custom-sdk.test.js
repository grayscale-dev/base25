import { beforeEach, describe, expect, test, vi } from "vitest";

const { supabase, env } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  },
  env: {
    supabaseUrl: "https://abc.supabase.co",
    supabaseAnonKey: "anon-key",
  },
}));

vi.mock("@/lib/supabase-client.js", () => ({ supabase }));
vi.mock("@/lib/env.js", () => ({ env }));

import { CustomEntity, UserEntity, createCustomClient } from "@/lib/custom-sdk";

function makeBuilder(result = { data: null, error: null }) {
  const builder = {
    result,
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (resolve, reject) => Promise.resolve(builder.result).then(resolve, reject),
  };
  return builder;
}

function jwt(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encoded}.sig`;
}

describe("custom-sdk", () => {
  beforeEach(() => {
    supabase.from.mockReset();
    supabase.auth.getUser.mockReset();
    supabase.auth.updateUser.mockReset();
    supabase.auth.signOut.mockReset();
    supabase.auth.getSession.mockReset();
    supabase.auth.refreshSession.mockReset();
    supabase.functions.invoke.mockReset();
    supabase.storage.from.mockReset();

    supabase.auth.signOut.mockResolvedValue({ error: null });
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabase.auth.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  test("CustomEntity list/filter/get/create/update/delete map fields and query correctly", async () => {
    const listBuilder = makeBuilder({
      data: [{ id: "i1", created_at: "2026-03-10", updated_at: "2026-03-10" }],
      error: null,
    });
    const filterBuilder = makeBuilder({ data: [{ id: "i2" }], error: null });
    const getBuilder = makeBuilder({ data: { id: "i3", created_at: "2026-01-01" }, error: null });
    const createBuilder = makeBuilder({ data: { id: "i4", created_at: "2026-01-02" }, error: null });
    const updateBuilder = makeBuilder({ data: { id: "i5", updated_at: "2026-01-03" }, error: null });
    const deleteBuilder = makeBuilder({ data: null, error: null });

    supabase.from
      .mockReturnValueOnce(listBuilder)
      .mockReturnValueOnce(filterBuilder)
      .mockReturnValueOnce(getBuilder)
      .mockReturnValueOnce(createBuilder)
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(deleteBuilder);

    const entity = new CustomEntity("items");

    const listed = await entity.list("-created_date", 5);
    expect(listBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(listBuilder.limit).toHaveBeenCalledWith(5);
    expect(listed[0]).toEqual(expect.objectContaining({ created_date: "2026-03-10" }));

    await entity.filter({ status_id: ["a", "b"], group_key: "feedback" }, "created_date");
    expect(filterBuilder.in).toHaveBeenCalledWith("status_id", ["a", "b"]);
    expect(filterBuilder.eq).toHaveBeenCalledWith("group_key", "feedback");

    const found = await entity.get("i3");
    expect(getBuilder.eq).toHaveBeenCalledWith("id", "i3");
    expect(found).toEqual(expect.objectContaining({ id: "i3", created_date: "2026-01-01" }));

    const created = await entity.create({ created_date: "x" });
    expect(createBuilder.insert).toHaveBeenCalledWith({ created_at: "x" });
    expect(created).toEqual(expect.objectContaining({ id: "i4" }));

    const updated = await entity.update("i5", { updated_date: "y" });
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ updated_at: expect.any(String) }));
    expect(updated).toEqual(expect.objectContaining({ id: "i5", updated_date: "2026-01-03" }));

    await entity.delete("i6");
    expect(deleteBuilder.delete).toHaveBeenCalled();
    expect(deleteBuilder.eq).toHaveBeenCalledWith("id", "i6");
  });

  test("CustomEntity handles missing-table errors gracefully", async () => {
    const missingTableError = {
      code: "PGRST205",
      message: "Could not find the table public.items",
    };

    supabase.from
      .mockReturnValueOnce(makeBuilder({ data: null, error: missingTableError }))
      .mockReturnValueOnce(makeBuilder({ data: null, error: missingTableError }))
      .mockReturnValueOnce(makeBuilder({ data: null, error: missingTableError }))
      .mockReturnValueOnce(makeBuilder({ data: null, error: missingTableError }));

    const entity = new CustomEntity("items");
    expect(await entity.list()).toEqual([]);
    expect(await entity.filter()).toEqual([]);
    expect(await entity.get("id")).toBeNull();
    await expect(entity.create({ title: "X" })).rejects.toThrow("Table items is not available");
  });

  test("UserEntity maps auth user and supports auth helpers", async () => {
    const userEntity = new UserEntity();

    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "owner@example.com",
          created_at: "2026-01-01",
          updated_at: "2026-01-02",
          user_metadata: {
            first_name: "Ada",
            last_name: "Lovelace",
            profile_photo_url: "https://img",
          },
        },
      },
      error: null,
    });

    const me = await userEntity.me();
    expect(me).toEqual(
      expect.objectContaining({
        id: "u1",
        first_name: "Ada",
        last_name: "Lovelace",
        full_name: "Ada Lovelace",
      })
    );

    supabase.auth.updateUser.mockResolvedValue({ error: null });
    const updated = await userEntity.updateMe({ first_name: "A" });
    expect(updated.id).toBe("u1");

    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Auth session missing" },
    });
    expect(await userEntity.isAuthenticated()).toBe(false);

    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "User from sub claim in JWT does not exist" },
    });
    expect(await userEntity.isAuthenticated()).toBe(false);
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  test("createCustomClient invokes functions with auth mode, refresh retry, and anon mode", async () => {
    const currentToken = jwt({ iss: "https://abc.supabase.co/auth/v1", exp: Math.floor(Date.now() / 1000) + 600 });
    const refreshedToken = jwt({ iss: "https://abc.supabase.co/auth/v1", exp: Math.floor(Date.now() / 1000) + 1200 });

    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: currentToken } } });
    supabase.functions.invoke
      .mockResolvedValueOnce({ data: null, error: { context: { status: 401 } } })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    supabase.auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: refreshedToken } },
      error: null,
    });

    const client = createCustomClient();

    const response = await client.functions.invoke("listItems", { workspace_id: "ws-1" }, { authMode: "user" });
    expect(response).toEqual({ data: { ok: true } });
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "listItems",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${currentToken}` }),
      })
    );
    expect(supabase.functions.invoke).toHaveBeenLastCalledWith(
      "listItems",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${refreshedToken}` }),
      })
    );

    supabase.functions.invoke.mockResolvedValueOnce({ data: { ok: "anon" }, error: null });
    const anonResult = await client.functions.invoke("publicGetWorkspace", {}, { authMode: "anon" });
    expect(anonResult).toEqual({ data: { ok: "anon" } });
    expect(supabase.functions.invoke).toHaveBeenLastCalledWith(
      "publicGetWorkspace",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${env.supabaseAnonKey}` }),
      })
    );
  });

  test("createCustomClient enforces auth and builds dynamic entity proxy cache", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabase.auth.refreshSession.mockResolvedValue({ data: { session: null }, error: null });

    const client = createCustomClient();

    await expect(client.functions.invoke("listItems", {}, { authMode: "user" })).rejects.toMatchObject({ status: 401 });

    const workspaceEntity = client.entities.Workspace;
    const workspaceEntityAgain = client.entities.Workspace;
    const customEntity = client.entities.CustomAuditTrail;

    expect(workspaceEntity).toBe(workspaceEntityAgain);
    expect(workspaceEntity.tableName).toBe("workspaces");
    expect(customEntity.tableName).toBe("custom_audit_trail");
    expect("Workspace" in client.entities).toBe(true);
  });
});
