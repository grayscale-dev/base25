
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
      // PRIMARY: Resolve from URL slug parameter
      const params = new URLSearchParams(window.location.search);
      const slug = params.get('slug');

      if (!slug) {
        // No slug in URL - cannot resolve board
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // Check sessionStorage cache first (optimization)
      const cachedWorkspace = sessionStorage.getItem('selectedWorkspace');
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
        const response = await base44.functions.invoke('publicGetWorkspace', { slug });
        
        if (!response.data) {
          setState(prev => ({ ...prev, loading: false }));
          return;
        }

        workspace = response.data;

        // Determine access level
        let user = null;
        try {
          user = await base44.auth.me();
          
          // Check if user has a role
          const roles = await base44.entities.WorkspaceRole.filter({
            workspace_id: workspace.id,
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
        sessionStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
        sessionStorage.setItem('selectedWorkspaceId', workspace.id);
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

    } catch (error) {
      console.error('Failed to load board context:', error);
      setState(prev => ({ ...prev, loading: false }));
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
  // Public access (unauthenticated or no role) - read-only
  if (isPublicAccess) {
    return {
      canView: true,
      canCreateFeedback: false,
      canCreateRoadmap: false,
      canCreateSupport: false,
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
    canCreateSupport: isContributor,
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
