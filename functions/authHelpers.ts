/**
 * Shared authorization helpers for backend functions
 * These enforce consistent auth/permission checks across all write endpoints
 */

/**
 * Standard error responses
 */
export const ErrorResponses = {
  UNAUTHORIZED: { error: 'Unauthorized', code: 'UNAUTHORIZED', message: 'Authentication required' },
  NAME_REQUIRED: { error: 'Name required', code: 'NAME_REQUIRED', message: 'Please set your first and last name before performing this action' },
  FORBIDDEN: { error: 'Forbidden', code: 'FORBIDDEN', message: 'Insufficient permissions' },
  WORKSPACE_NOT_FOUND: { error: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' },
  INVALID_INPUT: { error: 'Invalid input', code: 'INVALID_INPUT' }
};

/**
 * Check if user is authenticated
 * Returns { authenticated: boolean, user: object|null }
 */
export async function checkAuthentication(base44) {
  try {
    const user = await base44.auth.me();
    return { authenticated: true, user };
  } catch (error) {
    return { authenticated: false, user: null };
  }
}

/**
 * Require authentication - returns error response if not authenticated
 * Returns { success: boolean, user: object|null, error: Response|null }
 */
export async function requireAuth(base44) {
  const { authenticated, user } = await checkAuthentication(base44);
  
  if (!authenticated) {
    return {
      success: false,
      user: null,
      error: Response.json(ErrorResponses.UNAUTHORIZED, { status: 401 })
    };
  }
  
  return { success: true, user, error: null };
}

/**
 * Require first and last name for write actions
 * Contributors and admins must have both names set
 * Returns { success: boolean, error: Response|null }
 */
export function requireDisplayName(user) {
  const firstName = user?.first_name?.trim() || '';
  const lastName = user?.last_name?.trim() || '';

  if (!firstName || !lastName) {
    return {
      success: false,
      error: Response.json(ErrorResponses.NAME_REQUIRED, { status: 403 })
    };
  }
  
  return { success: true, error: null };
}

/**
 * Get user's role in a workspace
 * Returns role string or null if no role found
 */
export async function getUserWorkspaceRole(base44, workspaceId, userId) {
  try {
    const roles = await base44.asServiceRole.entities.WorkspaceRole.filter({
      workspace_id: workspaceId,
      user_id: userId
    });
    
    return roles.length > 0 ? roles[0].role : null;
  } catch (error) {
    console.error('Error fetching workspace role:', error);
    return null;
  }
}

/**
 * Role hierarchy for permission checks
 */
const ROLE_HIERARCHY = {
  'admin': 3,
  'contributor': 2,
  'viewer': 1
};

/**
 * Check if user has minimum required role
 * Returns { success: boolean, error: Response|null, role: string|null }
 */
export async function requireMinimumRole(base44, workspaceId, userId, minimumRole) {
  const userRole = await getUserWorkspaceRole(base44, workspaceId, userId);
  
  if (!userRole) {
    return {
      success: false,
      role: null,
      error: Response.json(ErrorResponses.FORBIDDEN, { status: 403 })
    };
  }
  
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;
  
  if (userLevel < requiredLevel) {
    return {
      success: false,
      role: userRole,
      error: Response.json({
        ...ErrorResponses.FORBIDDEN,
        message: `Requires ${minimumRole} role or higher`,
        current_role: userRole
      }, { status: 403 })
    };
  }
  
  return { success: true, role: userRole, error: null };
}

/**
 * Check if user is admin in workspace
 * Returns { success: boolean, error: Response|null }
 */
export async function requireAdmin(base44, workspaceId, userId) {
  return await requireMinimumRole(base44, workspaceId, userId, 'admin');
}

/**
 * Check if user is staff (admin)
 * Returns { success: boolean, error: Response|null, role: string|null }
 */
export async function requireStaff(base44, workspaceId, userId) {
  return await requireMinimumRole(base44, workspaceId, userId, 'admin');
}

/**
 * Verify workspace exists and is active
 * Returns { success: boolean, workspace: object|null, error: Response|null }
 */
export async function verifyWorkspace(base44, workspaceId) {
  try {
    const workspaces = await base44.asServiceRole.entities.Workspace.filter({
      id: workspaceId,
      status: 'active'
    });
    
    if (workspaces.length === 0) {
      return {
        success: false,
        workspace: null,
        error: Response.json(ErrorResponses.WORKSPACE_NOT_FOUND, { status: 404 })
      };
    }
    
    return { success: true, workspace: workspaces[0], error: null };
  } catch (error) {
    console.error('Error verifying workspace:', error);
    return {
      success: false,
      workspace: null,
      error: Response.json({ error: 'Failed to verify workspace' }, { status: 500 })
    };
  }
}

/**
 * Complete authorization flow for write actions requiring contributor+
 * Checks: auth, workspace exists, user has role, required names set
 * Returns { success: boolean, user, workspace, role, error: Response|null }
 */
export async function authorizeWriteAction(base44, workspaceId, minimumRole = 'contributor') {
  // 1. Check authentication
  const authCheck = await requireAuth(base44);
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }
  
  const user = authCheck.user;
  
  // 2. Verify workspace exists
  const workspaceCheck = await verifyWorkspace(base44, workspaceId);
  if (!workspaceCheck.success) {
    return { success: false, error: workspaceCheck.error };
  }
  
  // 3. Check user has minimum role
  const roleCheck = await requireMinimumRole(base44, workspaceId, user.id, minimumRole);
  if (!roleCheck.success) {
    return { success: false, error: roleCheck.error };
  }
  
  // 4. Require first + last name for contributors and above
  const nameCheck = requireDisplayName(user);
  if (!nameCheck.success) {
    return { success: false, error: nameCheck.error };
  }
  
  return {
    success: true,
    user,
    workspace: workspaceCheck.workspace,
    role: roleCheck.role,
    error: null
  };
}
