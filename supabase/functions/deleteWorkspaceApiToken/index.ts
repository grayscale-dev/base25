import { requireAuth, requireOwner, verifyWorkspace } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return new Response(authCheck.error.body, {
        status: authCheck.error.status,
        headers: corsHeaders,
      });
    }

    const payload = await req.json().catch(() => ({}));
    const workspaceId = String(payload?.workspace_id || "").trim();
    const tokenId = String(payload?.token_id || "").trim();

    if (!workspaceId || !tokenId) {
      return json({ error: "workspace_id and token_id are required" }, 400);
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

    const { error: deleteError } = await supabaseAdmin
      .from("api_tokens")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", tokenId);

    if (deleteError) {
      console.error("deleteWorkspaceApiToken delete error:", deleteError);
      return json({ error: "Failed to delete API token" }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("deleteWorkspaceApiToken unexpected error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
