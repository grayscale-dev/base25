import { requireAuth, requireOwner, verifyWorkspace } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import {
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

    const ownerCheck = await requireOwner(workspaceId, authCheck.user.id);
    if (!ownerCheck.success) {
      return new Response(ownerCheck.error.body, {
        status: ownerCheck.error.status,
        headers: corsHeaders,
      });
    }

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
          created_by: authCheck.user.id,
        },
        {
          onConflict: "workspace_id",
        },
      );

    if (upsertError) {
      console.error("Access code update error:", upsertError);
      return json({ error: "Failed to rotate access code" }, 500);
    }

    return json({
      has_code: true,
      masked_code: maskAccessCode(accessCode),
      access_code: accessCode,
      rotated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Access code handler error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
