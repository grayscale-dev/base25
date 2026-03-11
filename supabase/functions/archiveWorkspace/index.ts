import { requireAdmin, requireAuth, verifyWorkspace } from "../_shared/authHelpers.ts";
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

    if (!workspaceId) {
      return json({ error: "workspace_id is required" }, 400);
    }

    const workspaceCheck = await verifyWorkspace(workspaceId);
    if (!workspaceCheck.success) {
      return new Response(workspaceCheck.error.body, {
        status: workspaceCheck.error.status,
        headers: corsHeaders,
      });
    }

    const permissionCheck = await requireAdmin(workspaceId, authCheck.user.id);
    if (!permissionCheck.success) {
      return new Response(permissionCheck.error.body, {
        status: permissionCheck.error.status,
        headers: corsHeaders,
      });
    }

    if (permissionCheck.role !== "owner") {
      return json(
        {
          error: "Only the workspace owner can delete this workspace",
          code: "OWNER_REQUIRED_FOR_DELETE",
        },
        403,
      );
    }

    const { error: archiveError } = await supabaseAdmin
      .from("workspaces")
      .update({ status: "archived" })
      .eq("id", workspaceId);

    if (archiveError) {
      console.error("archiveWorkspace update error:", archiveError);
      return json({ error: "Failed to archive workspace" }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("archiveWorkspace unexpected error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
