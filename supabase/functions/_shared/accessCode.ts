const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FALLBACK_SECRET_SALT = "workspace-access-code-v1";

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function resolveSecretMaterial() {
  const explicitSecret = Deno.env.get("WORKSPACE_ACCESS_CODE_SECRET")?.trim();
  if (explicitSecret) return explicitSecret;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (serviceRole) return `${serviceRole}:${FALLBACK_SECRET_SALT}`;
  throw new Error("Missing WORKSPACE_ACCESS_CODE_SECRET (or SUPABASE_SERVICE_ROLE_KEY fallback)");
}

let encryptionKeyPromise: Promise<CryptoKey> | null = null;

async function getEncryptionKey() {
  if (!encryptionKeyPromise) {
    encryptionKeyPromise = (async () => {
      const secret = resolveSecretMaterial();
      const encoded = new TextEncoder().encode(secret);
      const digest = await crypto.subtle.digest("SHA-256", encoded);
      return await crypto.subtle.importKey(
        "raw",
        digest,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"],
      );
    })();
  }
  return encryptionKeyPromise;
}

export function generateAccessCode(length = 10) {
  const values = crypto.getRandomValues(new Uint8Array(length));
  let code = "";
  for (let index = 0; index < values.length; index += 1) {
    code += ACCESS_CODE_ALPHABET[values[index] % ACCESS_CODE_ALPHABET.length];
  }
  return code;
}

export async function hashAccessCode(code: string, salt: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function encryptAccessCode(code: string) {
  const key = await getEncryptionKey();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(code);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    plaintext,
  );

  return {
    codeCiphertext: toBase64(encrypted),
    codeNonce: toBase64(nonce.buffer),
  };
}

export async function decryptAccessCode(codeCiphertext: string, codeNonce: string) {
  const key = await getEncryptionKey();
  const encrypted = fromBase64(codeCiphertext);
  const nonce = fromBase64(codeNonce);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    encrypted,
  );
  return new TextDecoder().decode(decrypted);
}

export function maskAccessCode(code: string, visibleTailLength = 0) {
  const normalized = String(code || "").trim();
  if (!normalized) return "";
  if (visibleTailLength <= 0) {
    return "•".repeat(normalized.length);
  }
  const visibleTail = normalized.slice(-visibleTailLength);
  return `${"•".repeat(Math.max(0, normalized.length - visibleTailLength))}${visibleTail}`;
}
