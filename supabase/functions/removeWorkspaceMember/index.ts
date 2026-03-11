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

    const actorRole = permissionCheck.role;

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
      if (actorRole !== "owner") {
        return json(
          {
            error: "Only owners can remove owners",
            code: "OWNER_REQUIRED_FOR_OWNER_REMOVAL",
          },
          403,
        );
      }

      const { count: ownerCount, error: ownerCountError } = await supabaseAdmin
        .from("workspace_roles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("role", "owner");

      if (ownerCountError) {
        console.error("removeWorkspaceMember owner count error:", ownerCountError);
        return json({ error: "Failed to validate owner count" }, 500);
      }

      if ((ownerCount || 0) <= 1) {
        return json(
          {
            error: "Add another owner before removing the last owner",
            code: "LAST_OWNER_PROTECTION",
          },
          409,
        );
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
