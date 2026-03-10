import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  getBoardSession,
  getOrCreateAnalyticsSessionId,
  setBoardSession,
} from '@/lib/board-session';

/**
 * BoardContext Model
 * 
 * Provides centralized workspace state and permissions for all workspace pages.
 * Single source of truth that replaces scattered auth checks.
 */

const BoardContext = createContext(null);

export function useBoardContext() {
  const context = useContext(BoardContext);
  if (!context) {
    throw new Error('useBoardContext must be used within BoardProvider');
  }
  return context;
}

export function BoardProvider({ children }) {
  const [state, setState] = useState({
    // Core state
    workspace: null,
    user: null,
    role: 'viewer',
    isPublicAccess: false,
    loading: true,
    
    // Computed permissions
    permissions: {
      canView: false,
      canCreateItems: false,
      canComment: false,
      canManageSettings: false,
      canModerateContent: false,
      isStaff: false,
      isAdmin: false
    },
    
    // Messages for UI
    messages: {
      loginPrompt: null,
      accessDenied: null
    }
  });

  useEffect(() => {
    loadBoardContext();
  }, []);

  const loadBoardContext = async () => {
    try {
      // Resolve from URL path params (/workspace/:slug/:section).
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const rootSegment = pathParts[0];
      const slug =
        rootSegment === 'workspace' ? pathParts[1] : null;

      if (!slug) {
        // No slug in URL path - cannot resolve workspace
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // Check sessionStorage cache first (optimization)
      const cachedSession = getBoardSession();
      const cachedWorkspace = cachedSession.workspace;
      const cachedSlug = cachedWorkspace?.slug || null;

      let workspace;
      let role = 'viewer';
      let isPublicAccess = false;

      if (cachedSlug === slug) {
        // Cache hit - use sessionStorage
        workspace = cachedWorkspace;
        role = cachedSession.role || 'viewer';
        isPublicAccess = cachedSession.isPublicAccess;
      } else {
        // Cache miss or different slug - resolve from API
        let workspaceResponse = null;
        try {
          workspaceResponse = await base44.functions.invoke('publicGetBoard', { slug });
        } catch (publicError) {
          const status = publicError?.status || publicError?.response?.status;
          if (status === 401) {
            await base44.auth.logout();
            setState(prev => ({ ...prev, loading: false }));
            return;
          }
          if (status === 403) {
            setState(prev => ({ ...prev, loading: false }));
            return;
          }
          throw publicError;
        }

        if (!workspaceResponse?.data) {
          setState(prev => ({ ...prev, loading: false }));
          return;
        }

        workspace = workspaceResponse.data;

        // Determine access level
        let user = null;
        try {
          user = await base44.auth.me();
          
          // Check if user has a role
          const roles = await base44.entities.BoardRole.filter({
            board_id: workspace.id,
            user_id: user.id
          });

          if (roles.length > 0) {
            role = roles[0].role;
            isPublicAccess = false;
          } else {
            // Authenticated but no role
            role = 'viewer';
            isPublicAccess = true;
          }
        } catch {
          // Not authenticated
          if (workspace.visibility === 'public') {
            isPublicAccess = true;
          }
        }

        // Cache in sessionStorage for optimization
        setBoardSession({ workspace, role, isPublicAccess });
      }

      // Get current user
      let user = null;
      try {
        user = await base44.auth.me();
      } catch {
        // Not authenticated
      }

      // Compute permissions
      const permissions = computePermissions(role, isPublicAccess);
      const messages = computeMessages(isPublicAccess, user);

      setState({
        workspace,
        user,
        role,
        isPublicAccess,
        loading: false,
        permissions,
        messages
      });

      // Track view (fire and forget, don't block UI)
      trackBoardView(slug).catch(() => {
        // Silently fail if tracking fails
      });

    } catch (error) {
      console.error('Failed to load workspace context:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const trackBoardView = async (slug) => {
    try {
      // Generate or retrieve session ID (persists across page loads)
      const sessionId = getOrCreateAnalyticsSessionId();
      if (!sessionId) return;

      await base44.functions.invoke('publicTrackBoardView', {
        slug,
        session_id: sessionId,
        referrer: document.referrer || undefined
      });
    } catch {
      // Silent fail - analytics should never break the app
    }
  };

  const refresh = () => {
    loadBoardContext();
  };

  return (
    <BoardContext.Provider value={{ ...state, refresh }}>
      {children}
    </BoardContext.Provider>
  );
}

/**
 * Compute permissions based on role and access type
 */
function computePermissions(role, isPublicAccess) {
  // Public access (unauthenticated or no role) - read-only
  if (isPublicAccess) {
    return {
      canView: true,
      canCreateItems: false,
      canComment: false,
      canManageSettings: false,
      canModerateContent: false,
      isStaff: false,
      isAdmin: false
    };
  }

  // Authenticated with role
  const isAdmin = role === 'admin';
  const isStaff = role === 'admin';
  const isContributor = role === 'contributor' || isStaff;

  return {
    canView: true,
    canCreateItems: isContributor,
    canComment: isContributor,
    canManageSettings: isAdmin,
    canModerateContent: isStaff,
    isStaff,
    isAdmin
  };
}

/**
 * Compute UI messages for various states
 */
function computeMessages(isPublicAccess, user) {
  // Unauthenticated public viewer
  if (isPublicAccess && !user) {
    return {
      loginPrompt: 'Login to contribute feedback and interact with this workspace',
      accessDenied: null
    };
  }

      // Authenticated but public access (no role)
  if (isPublicAccess && user) {
    return {
      loginPrompt: null,
      accessDenied: "You don't have permission to contribute to this workspace. Contact the admin to request access."
    };
  }

  // Full access
  return {
    loginPrompt: null,
    accessDenied: null
  };
}
