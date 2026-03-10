import { requireAdmin, requireAuth, verifyWorkspace } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateAccessCode(length = 10) {
  const values = crypto.getRandomValues(new Uint8Array(length));
  let code = "";
  for (let i = 0; i < values.length; i += 1) {
    code += ACCESS_CODE_ALPHABET[values[i] % ACCESS_CODE_ALPHABET.length];
  }
  return code;
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashCode(code: string, salt: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

function computeExpiry(option: string) {
  const now = new Date();
  if (option === "24h") {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  if (option === "7d") {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  if (option === "30d") {
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return new Response(authCheck.error.body, {
        status: authCheck.error.status,
        headers: corsHeaders,
      });
    }

    const payload = await req.json().catch(() => ({}));
    const workspaceId = payload.workspace_id;
    const expiresIn = payload.expires_in ?? "never";

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "Missing workspace_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceCheck = await verifyWorkspace(workspaceId);
    if (!workspaceCheck.success) {
      return new Response(workspaceCheck.error.body, {
        status: workspaceCheck.error.status,
        headers: corsHeaders,
      });
    }

    const adminCheck = await requireAdmin(workspaceId, authCheck.user.id);
    if (!adminCheck.success) {
      return new Response(adminCheck.error.body, {
        status: adminCheck.error.status,
        headers: corsHeaders,
      });
    }

    const code = generateAccessCode();
    const salt = crypto.randomUUID();
    const hash = await hashCode(code, salt);
    const expiresAt = computeExpiry(expiresIn);

    const { error } = await supabaseAdmin.from("workspace_access_codes").upsert({
      workspace_id: workspaceId,
      code_hash: hash,
      code_salt: salt,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      created_by: authCheck.user.id,
    });

    if (error) {
      console.error("Access code update error:", error);
      return new Response(JSON.stringify({ error: "Failed to create access code" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        access_code: code,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Access code handler error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
