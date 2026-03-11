import {
  checkAuthentication,
  getUserWorkspaceRole,
  verifyWorkspace,
} from "./authHelpers.ts";
import { supabaseAdmin } from "./supabase.ts";

export async function resolveWorkspaceFromPayload(payload: Record<string, unknown>) {
  const workspaceId = typeof payload.workspace_id === "string" ? payload.workspace_id : null;
  const slug = typeof payload.slug === "string" ? payload.slug : null;

  if (workspaceId) {
    return { workspaceId, workspace: null, error: null };
  }

  if (!slug) {
    return { workspaceId: null, workspace: null, error: "workspace_id or slug is required" };
  }

  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("resolveWorkspaceFromPayload slug lookup error:", error);
    return { workspaceId: null, workspace: null, error: "Unable to resolve workspace" };
  }

  if (!data) {
    return { workspaceId: null, workspace: null, error: "Workspace not found" };
  }

  return { workspaceId: data.id as string, workspace: data, error: null };
}

export async function requireWorkspaceReadAccess(req: Request, payload: Record<string, unknown>) {
  const workspaceLookup = await resolveWorkspaceFromPayload(payload);
  if (!workspaceLookup.workspaceId) {
    return {
      success: false,
      status: 400,
      error: workspaceLookup.error || "Invalid workspace reference",
      workspace: null,
      user: null,
      role: null,
      isPublicAccess: false,
    };
  }

  const workspaceCheck = workspaceLookup.workspace
    ? { success: true, workspace: workspaceLookup.workspace, error: null }
    : await verifyWorkspace(workspaceLookup.workspaceId);

  if (!workspaceCheck.success) {
    return {
      success: false,
      status: 404,
      error: "Workspace not found",
      workspace: null,
      user: null,
      role: null,
      isPublicAccess: false,
    };
  }

  const authCheck = await checkAuthentication(req);

  if (workspaceCheck.workspace.visibility === "public" && !authCheck.authenticated) {
    return {
      success: true,
      workspace: workspaceCheck.workspace,
      user: null,
      role: null,
      isPublicAccess: true,
    };
  }

  if (!authCheck.authenticated || !authCheck.user) {
    return {
      success: false,
      status: 401,
      error: "Authentication required",
      workspace: null,
      user: null,
      role: null,
      isPublicAccess: false,
    };
  }

  const role = await getUserWorkspaceRole(workspaceLookup.workspaceId, authCheck.user.id);
  if (!role && workspaceCheck.workspace.visibility !== "public") {
    return {
      success: false,
      status: 403,
      error: "This workspace is not accessible",
      workspace: null,
      user: authCheck.user,
      role: null,
      isPublicAccess: false,
    };
  }

  return {
    success: true,
    workspace: workspaceCheck.workspace,
    user: authCheck.user,
    role: role || "contributor",
    isPublicAccess: !role,
  };
}
