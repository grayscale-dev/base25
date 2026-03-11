import { requireAdmin, requireAuth, verifyWorkspace } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import {
  decryptAccessCode,
  encryptAccessCode,
  generateAccessCode,
  hashAccessCode,
  maskAccessCode,
} from "../_shared/accessCode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-access-token, x-forwarded-authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function createOrRotateAccessCode(workspaceId: string, userId: string) {
  const accessCode = generateAccessCode();
  const codeSalt = crypto.randomUUID();
  const codeHash = await hashAccessCode(accessCode, codeSalt);
  const encryptedCode = await encryptAccessCode(accessCode);

  const { error: upsertError } = await supabaseAdmin
    .from("workspace_access_codes")
    .upsert(
      {
        workspace_id: workspaceId,
        code_hash: codeHash,
        code_salt: codeSalt,
        code_ciphertext: encryptedCode.codeCiphertext,
        code_nonce: encryptedCode.codeNonce,
        expires_at: null,
        created_by: userId,
      },
      { onConflict: "workspace_id" },
    );

  if (upsertError) {
    throw upsertError;
  }

  return accessCode;
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
    const workspaceId = String(payload.workspace_id || "").trim();
    const reveal = Boolean(payload.reveal);

    if (!workspaceId) {
      return json({ error: "Missing workspace_id" }, 400);
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

    const { data: existingCodeRow, error: lookupError } = await supabaseAdmin
      .from("workspace_access_codes")
      .select("code_hash, code_salt, code_ciphertext, code_nonce, created_at, created_by")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (lookupError) {
      console.error("Access code lookup error:", lookupError);
      return json({ error: "Failed to load access code" }, 500);
    }

    let accessCode = "";
    let createdAt = existingCodeRow?.created_at || null;

    const needsBootstrap = !existingCodeRow
      || !existingCodeRow.code_hash
      || !existingCodeRow.code_salt
      || !existingCodeRow.code_ciphertext
      || !existingCodeRow.code_nonce;

    if (needsBootstrap) {
      try {
        accessCode = await createOrRotateAccessCode(workspaceId, authCheck.user.id);
        createdAt = new Date().toISOString();
      } catch (bootstrapError) {
        console.error("Access code bootstrap error:", bootstrapError);
        return json({ error: "Failed to initialize access code" }, 500);
      }
    } else if (reveal) {
      try {
        accessCode = await decryptAccessCode(
          String(existingCodeRow.code_ciphertext),
          String(existingCodeRow.code_nonce),
        );
      } catch (decryptError) {
        console.error("Access code decrypt error, rotating code:", decryptError);
        try {
          accessCode = await createOrRotateAccessCode(workspaceId, authCheck.user.id);
          createdAt = new Date().toISOString();
        } catch (rotationError) {
          console.error("Access code rotation fallback failed:", rotationError);
          return json({ error: "Failed to load access code" }, 500);
        }
      }
    }

    const maskedCode = accessCode
      ? maskAccessCode(accessCode)
      : maskAccessCode("XXXXXXXXXX");

    return json({
      has_code: true,
      masked_code: maskedCode,
      access_code: reveal ? accessCode : null,
      created_at: createdAt,
    });
  } catch (error) {
    console.error("Access code status error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
