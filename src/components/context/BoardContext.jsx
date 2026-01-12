import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * BoardContext Model
 * 
 * Provides centralized board state and permissions for all board pages.
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
      canCreateFeedback: false,
      canCreateRoadmap: false,
      canCreateSupport: false,
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
      // PRIMARY: Resolve from URL path params (/board/:slug/:section)
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const slug = pathParts[0] === 'board' ? pathParts[1] : null;

      if (!slug) {
        // No slug in URL path - cannot resolve board
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // Check sessionStorage cache first (optimization)
      const cachedWorkspace = sessionStorage.getItem('selectedBoard');
      const cachedSlug = cachedWorkspace ? JSON.parse(cachedWorkspace).slug : null;

      let workspace;
      let role = 'viewer';
      let isPublicAccess = false;

      if (cachedSlug === slug) {
        // Cache hit - use sessionStorage
        workspace = JSON.parse(cachedWorkspace);
        role = sessionStorage.getItem('currentRole') || 'viewer';
        isPublicAccess = sessionStorage.getItem('isPublicAccess') === 'true';
      } else {
        // Cache miss or different slug - resolve from API
        let workspaceResponse = null;
        try {
          workspaceResponse = await base44.functions.invoke('publicGetBoard', { slug });
        } catch (publicError) {
          const status = publicError?.status || publicError?.response?.status;
          if (status === 403) {
            const results = await base44.entities.Board.filter({ slug });
            workspaceResponse = { data: results[0] || null };
          } else {
            throw publicError;
          }
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
        } catch (error) {
          // Not authenticated
          if (workspace.visibility === 'public') {
            isPublicAccess = true;
          }
        }

        // Cache in sessionStorage for optimization
        sessionStorage.setItem('selectedBoard', JSON.stringify(workspace));
        sessionStorage.setItem('selectedBoardId', workspace.id);
        sessionStorage.setItem('currentRole', role);
        sessionStorage.setItem('isPublicAccess', isPublicAccess.toString());
      }

      // Get current user
      let user = null;
      try {
        user = await base44.auth.me();
      } catch (error) {
        // Not authenticated
      }

      // Compute permissions
      const permissions = computePermissions(role, isPublicAccess, user);
      const messages = computeMessages(isPublicAccess, user, role, permissions);

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
      console.error('Failed to load board context:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const trackBoardView = async (slug) => {
    try {
      // Generate or retrieve session ID (persists across page loads)
      let sessionId = sessionStorage.getItem('analytics_session_id');
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        sessionStorage.setItem('analytics_session_id', sessionId);
      }

      await base44.functions.invoke('publicTrackBoardView', {
        slug,
        session_id: sessionId,
        referrer: document.referrer || undefined
      });
    } catch (error) {
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
function computePermissions(role, isPublicAccess, user) {
  // Public access (unauthenticated or no role) - read-only, no support
  if (isPublicAccess) {
    return {
      canView: true,
      canCreateFeedback: false,
      canCreateRoadmap: false,
      canCreateSupport: false, // Support is never public
      canComment: false,
      canManageSettings: false,
      canModerateContent: false,
      isStaff: false,
      isAdmin: false
    };
  }

  // Authenticated with role
  const isAdmin = role === 'admin';
  const isStaff = role === 'admin' || role === 'support';
  const isContributor = role === 'contributor' || isStaff;

  return {
    canView: true,
    canCreateFeedback: isContributor,
    canCreateRoadmap: isStaff,
    canCreateSupport: isContributor, // Support requires role
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
function computeMessages(isPublicAccess, user, role, permissions) {
  // Unauthenticated public viewer
  if (isPublicAccess && !user) {
    return {
      loginPrompt: 'Login to contribute feedback and interact with this board',
      accessDenied: null
    };
  }

  // Authenticated but public access (no role)
  if (isPublicAccess && user) {
    return {
      loginPrompt: null,
      accessDenied: "You don't have permission to contribute to this board. Contact the admin to request access."
    };
  }

  // Full access
  return {
    loginPrompt: null,
    accessDenied: null
  };
}
