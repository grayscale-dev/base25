import { getSupabaseClient, supabaseAdmin } from "./supabase.ts";

export const ErrorResponses = {
  UNAUTHORIZED: {
    error: "Unauthorized",
    code: "UNAUTHORIZED",
    message: "Authentication required",
  },
  NAME_REQUIRED: {
    error: "Name required",
    code: "NAME_REQUIRED",
    message: "Please set your first and last name before performing this action",
  },
  FORBIDDEN: {
    error: "Forbidden",
    code: "FORBIDDEN",
    message: "Insufficient permissions",
  },
  WORKSPACE_NOT_FOUND: {
    error: "Workspace not found",
    code: "WORKSPACE_NOT_FOUND",
  },
  INVALID_INPUT: { error: "Invalid input", code: "INVALID_INPUT" },
};

function toAppUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};
  const firstName = (
    (metadata.first_name as string | undefined) ??
    (metadata.given_name as string | undefined) ??
    ""
  ).trim();
  const lastName = (
    (metadata.last_name as string | undefined) ??
    (metadata.family_name as string | undefined) ??
    ""
  ).trim();
  const fullName =
    ((metadata.full_name as string | undefined) ??
      (metadata.name as string | undefined) ??
      "").trim();
  const fullNameParts = fullName ? fullName.split(/\s+/).filter(Boolean) : [];
  const fallbackFirstName =
    firstName || (fullNameParts.length > 0 ? fullNameParts.slice(0, -1).join(" ") || fullNameParts[0] : "");
  const fallbackLastName =
    lastName || (fullNameParts.length > 1 ? fullNameParts.slice(-1).join("") : "");

  return {
    id: user.id,
    email: user.email ?? null,
    first_name: fallbackFirstName,
    last_name: fallbackLastName,
    full_name: `${fallbackFirstName} ${fallbackLastName}`.trim() || fullName,
    profile_photo_url: metadata.profile_photo_url as string | undefined,
  };
}

export async function checkAuthentication(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const forwardedAuthHeader = req.headers.get("x-forwarded-authorization") ?? "";
  const forwardedTokenMatch = forwardedAuthHeader.match(/^Bearer\s+(.+)$/i);
  const fallbackToken = req.headers.get("x-user-access-token") ?? "";
  const token = (tokenMatch?.[1] ?? forwardedTokenMatch?.[1] ?? fallbackToken) || null;

  const supabase = getSupabaseClient(req);

  if (!token) {
    const gatewayAuthUserId = req.headers.get("x-supabase-auth-user") ??
      req.headers.get("x-auth-user") ??
      req.headers.get("x-sb-auth-user") ??
      "";
    if (gatewayAuthUserId) {
      const { data: gatewayUserData, error: gatewayUserError } = await supabaseAdmin.auth.admin
        .getUserById(gatewayAuthUserId);
      if (!gatewayUserError && gatewayUserData?.user) {
        return {
          authenticated: true,
          user: toAppUser(gatewayUserData.user),
          supabase,
        };
      }
    }

    console.log("Auth token missing in function request", {
      hasAuthorizationHeader: Boolean(authHeader),
      hasForwardedAuthorizationHeader: Boolean(forwardedAuthHeader),
      hasFallbackTokenHeader: Boolean(fallbackToken),
      hasGatewayAuthUser: Boolean(gatewayAuthUserId),
    });
    return { authenticated: false, user: null, supabase, reason: "missing_token" };
  }

  // Prefer request-scoped validation so function auth does not depend on
  // service-role auth client availability for basic user verification.
  const { data: requestScopedData, error: requestScopedError } = await supabase
    .auth
    .getUser(token);
  if (!requestScopedError && requestScopedData?.user) {
    return { authenticated: true, user: toAppUser(requestScopedData.user), supabase };
  }

  // Fallback to admin token verification for environments where request-scoped
  // auth forwarding is unavailable.
  const { data: adminData, error: adminError } = await supabaseAdmin.auth.getUser(token);
  if (adminError || !adminData?.user) {
    if (requestScopedError || adminError) {
      console.log("Auth getUser failed:", {
        requestScopedError: requestScopedError?.message ?? null,
        adminError: adminError?.message ?? null,
      });
    }
    return { authenticated: false, user: null, supabase, reason: "token_lookup_failed" };
  }

  return { authenticated: true, user: toAppUser(adminData.user), supabase, reason: null };
}

export async function requireAuth(req: Request) {
  const { authenticated, user, supabase, reason } = await checkAuthentication(req);

  if (!authenticated) {
    return {
      success: false,
      user: null,
      supabase,
      error: Response.json(
        {
          ...ErrorResponses.UNAUTHORIZED,
          reason: reason ?? "unknown_auth_failure",
        },
        { status: 401 },
      ),
    };
  }

  return { success: true, user, supabase, error: null };
}

export function requireDisplayName(
  user: { first_name?: string | null; last_name?: string | null; full_name?: string | null },
) {
  const firstName = user.first_name?.trim() ?? "";
  const lastName = user.last_name?.trim() ?? "";
  if (!firstName || !lastName) {
    return {
      success: false,
      error: Response.json(ErrorResponses.NAME_REQUIRED, { status: 403 }),
    };
  }

  return { success: true, error: null };
}

export async function getUserWorkspaceRole(
  workspaceId: string,
  userId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("workspace_roles")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching workspace role:", error);
    return null;
  }

  return data?.role ?? null;
}

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4,
  admin: 3,
  contributor: 2,
  viewer: 1,
};

export function isAdminLikeRole(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

export async function requireMinimumRole(
  workspaceId: string,
  userId: string,
  minimumRole: string,
) {
  const userRole = await getUserWorkspaceRole(workspaceId, userId);

  if (!userRole) {
    return {
      success: false,
      role: null,
      error: Response.json(ErrorResponses.FORBIDDEN, { status: 403 }),
    };
  }

  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;

  if (userLevel < requiredLevel) {
    return {
      success: false,
      role: userRole,
      error: Response.json(
        {
          ...ErrorResponses.FORBIDDEN,
          message: `Requires ${minimumRole} role or higher`,
          current_role: userRole,
        },
        { status: 403 },
      ),
    };
  }

  return { success: true, role: userRole, error: null };
}

export async function requireAdmin(workspaceId: string, userId: string) {
  return await requireMinimumRole(workspaceId, userId, "admin");
}

export async function requireStaff(workspaceId: string, userId: string) {
  return await requireMinimumRole(workspaceId, userId, "admin");
}

export async function verifyWorkspace(workspaceId: string) {
  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error verifying workspace:", error);
    return {
      success: false,
      workspace: null,
      error: Response.json({ error: "Failed to verify workspace" }, { status: 500 }),
    };
  }

  if (!data) {
    return {
      success: false,
      workspace: null,
      error: Response.json(ErrorResponses.WORKSPACE_NOT_FOUND, { status: 404 }),
    };
  }

  return { success: true, workspace: data, error: null };
}

export async function authorizeWriteAction(
  req: Request,
  workspaceId: string,
  minimumRole = "contributor",
) {
  const authCheck = await requireAuth(req);
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  const user = authCheck.user;

  const workspaceCheck = await verifyWorkspace(workspaceId);
  if (!workspaceCheck.success) {
    return { success: false, error: workspaceCheck.error };
  }

  const roleCheck = await requireMinimumRole(
    workspaceId,
    user.id,
    minimumRole,
  );
  if (!roleCheck.success) {
    return { success: false, error: roleCheck.error };
  }

  const nameCheck = requireDisplayName(user);
  if (!nameCheck.success) {
    return { success: false, error: nameCheck.error };
  }

  return {
    success: true,
    user,
    workspace: workspaceCheck.workspace,
    role: roleCheck.role,
    supabase: authCheck.supabase,
    error: null,
  };
}
