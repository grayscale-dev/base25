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
    const memberId = String(payload?.member_id || "").trim();
    const transferToMemberId = String(payload?.transfer_to_member_id || "").trim();

    if (!workspaceId || !memberId) {
      return json({ error: "workspace_id and member_id are required" }, 400);
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

    const { data: targetMember, error: targetMemberError } = await supabaseAdmin
      .from("workspace_roles")
      .select("id, workspace_id, user_id, email, role")
      .eq("id", memberId)
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();

    if (targetMemberError) {
      console.error("removeWorkspaceMember lookup error:", targetMemberError);
      return json({ error: "Failed to load member" }, 500);
    }
    if (!targetMember) {
      return json({ error: "Member not found" }, 404);
    }

    if (targetMember.role === "owner") {
      if (!transferToMemberId) {
        return json(
          {
            error: "Transfer ownership before removing the owner",
            code: "OWNERSHIP_TRANSFER_REQUIRED",
          },
          409,
        );
      }
      if (transferToMemberId === memberId) {
        return json({ error: "Choose a different member as the new owner" }, 400);
      }

      const { data: transferTarget, error: transferTargetError } = await supabaseAdmin
        .from("workspace_roles")
        .select("id, user_id")
        .eq("id", transferToMemberId)
        .eq("workspace_id", workspaceId)
        .limit(1)
        .maybeSingle();

      if (transferTargetError) {
        console.error("removeWorkspaceMember transfer target lookup error:", transferTargetError);
        return json({ error: "Failed to load transfer target" }, 500);
      }
      if (!transferTarget) {
        return json({ error: "Transfer target member not found" }, 404);
      }

      const { error: transferError } = await supabaseAdmin.rpc("transfer_workspace_owner", {
        target_workspace_id: workspaceId,
        target_user_id: transferTarget.user_id,
      });
      if (transferError) {
        console.error("removeWorkspaceMember ownership transfer error:", transferError);
        return json({ error: "Failed to transfer ownership" }, 500);
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("workspace_roles")
      .delete()
      .eq("id", memberId)
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      console.error("removeWorkspaceMember delete error:", deleteError);
      return json({ error: "Failed to remove member" }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("removeWorkspaceMember unexpected error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
