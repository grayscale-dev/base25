import {
  decryptAccessCode,
  encryptAccessCode,
  generateAccessCode,
  hashAccessCode,
  maskAccessCode,
} from "../../supabase/functions/_shared/accessCode.ts";

describe("edge shared access-code helpers", () => {
  const originalDeno = globalThis.Deno;

  beforeEach(() => {
    globalThis.Deno = {
      env: {
        get: vi.fn((key) => {
          if (key === "WORKSPACE_ACCESS_CODE_SECRET") return "super-secret-for-tests";
          return "";
        }),
      },
    };
  });

  afterEach(() => {
    globalThis.Deno = originalDeno;
  });

  test("generateAccessCode uses expected charset and length", () => {
    const code = generateAccessCode(10);
    expect(code).toHaveLength(10);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });

  test("hashAccessCode is deterministic for code + salt", async () => {
    const hash1 = await hashAccessCode("ABCD1234", "salt-1");
    const hash2 = await hashAccessCode("ABCD1234", "salt-1");
    const hash3 = await hashAccessCode("ABCD1234", "salt-2");
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  test("maskAccessCode hides full or partial code", () => {
    expect(maskAccessCode("ABCDEFGH")).toBe("••••••••");
    expect(maskAccessCode("ABCDEFGH", 4)).toBe("••••EFGH");
    expect(maskAccessCode("")).toBe("");
  });

  test("encryptAccessCode/decryptAccessCode round trip", async () => {
    const encrypted = await encryptAccessCode("ACME1234");
    expect(encrypted.codeCiphertext).toBeTruthy();
    expect(encrypted.codeNonce).toBeTruthy();

    const decrypted = await decryptAccessCode(
      encrypted.codeCiphertext,
      encrypted.codeNonce
    );
    expect(decrypted).toBe("ACME1234");
  });
});
