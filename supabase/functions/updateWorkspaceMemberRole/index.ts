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

const ALLOWED_ROLES = new Set(["contributor", "admin", "owner"]);

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
    const nextRole = String(payload?.role || "").trim().toLowerCase();

    if (!workspaceId || !memberId || !nextRole) {
      return json({ error: "workspace_id, member_id, and role are required" }, 400);
    }
    if (!ALLOWED_ROLES.has(nextRole)) {
      return json({ error: "role is invalid" }, 400);
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
      console.error("updateWorkspaceMemberRole lookup error:", targetMemberError);
      return json({ error: "Failed to load member" }, 500);
    }
    if (!targetMember) {
      return json({ error: "Member not found" }, 404);
    }

    if (targetMember.role === nextRole) {
      return json(targetMember);
    }

    const targetIsOwner = targetMember.role === "owner";
    const nextIsOwner = nextRole === "owner";

    if (nextIsOwner && actorRole !== "owner") {
      return json(
        {
          error: "Only owners can grant owner role",
          code: "OWNER_REQUIRED_FOR_OWNER_ASSIGNMENT",
        },
        403,
      );
    }

    if (targetIsOwner && actorRole !== "owner") {
      return json(
        {
          error: "Only owners can modify owner roles",
          code: "OWNER_REQUIRED_FOR_OWNER_MUTATION",
        },
        403,
      );
    }

    if (targetIsOwner && !nextIsOwner) {
      const { count: ownerCount, error: ownerCountError } = await supabaseAdmin
        .from("workspace_roles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("role", "owner");

      if (ownerCountError) {
        console.error("updateWorkspaceMemberRole owner count error:", ownerCountError);
        return json({ error: "Failed to validate owner count" }, 500);
      }

      if ((ownerCount || 0) <= 1) {
        return json(
          {
            error: "Add another owner before removing owner access",
            code: "LAST_OWNER_PROTECTION",
          },
          409,
        );
      }
    }

    const { data: updatedMember, error: updateError } = await supabaseAdmin
      .from("workspace_roles")
      .update({ role: nextRole })
      .eq("id", memberId)
      .eq("workspace_id", workspaceId)
      .select("id, workspace_id, user_id, email, role")
      .single();

    if (updateError) {
      console.error("updateWorkspaceMemberRole update error:", updateError);
      return json({ error: "Failed to update member role" }, 500);
    }

    return json(updatedMember);
  } catch (error) {
    console.error("updateWorkspaceMemberRole unexpected error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
