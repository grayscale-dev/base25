import { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { canContributeRole, isAdminRole } from "@/lib/roles";
import {
  getWorkspaceSession,
  getOrCreateAnalyticsSessionId,
  setWorkspaceSession,
} from "@/lib/workspace-session";
import { fetchWorkspaceBootstrapCached } from "@/lib/workspace-queries";

const WorkspaceContext = createContext(null);

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
  }
  return context;
}

function getSlugFromPath(pathname) {
  const pathParts = String(pathname || "")
    .split("/")
    .filter(Boolean);
  return pathParts[0] === "workspace" ? pathParts[1] || null : null;
}

function normalizeWorkspace(bootstrap) {
  if (!bootstrap?.id) return null;
  return {
    id: bootstrap.id,
    name: bootstrap.name,
    slug: bootstrap.slug,
    description: bootstrap.description || "",
    logo_url: bootstrap.logo_url || "",
    primary_color: bootstrap.primary_color || "#0f172a",
    visibility: bootstrap.visibility || "restricted",
    billing_status: bootstrap.billing_status || "inactive",
    billing_access_allowed: bootstrap.billing_access_allowed !== false,
  };
}

function getErrorStatus(error) {
  if (!error) return null;
  return error.status ?? error.context?.status ?? error.response?.status ?? null;
}

export function WorkspaceProvider({ children }) {
  const [state, setState] = useState({
    workspace: null,
    user: null,
    role: "contributor",
    isPublicAccess: false,
    loading: true,
    permissions: {
      canView: false,
      canCreateItems: false,
      canComment: false,
      canManageSettings: false,
      canModerateContent: false,
      isStaff: false,
      isAdmin: false,
    },
    messages: {
      loginPrompt: null,
      accessDenied: null,
    },
  });

  useEffect(() => {
    void loadWorkspaceContext();
  }, []);

  const loadWorkspaceContext = async () => {
    try {
      const slug = getSlugFromPath(window.location.pathname);
      if (!slug) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      const session = getWorkspaceSession();
      let workspace =
        session.workspace?.slug === slug
          ? session.workspace
          : null;
      let role = workspace ? session.role || "contributor" : "contributor";
      let isPublicAccess = workspace ? Boolean(session.isPublicAccess) : false;

      let user = null;
      try {
        user = await base44.auth.me();
      } catch {
        user = null;
      }

      if (!workspace && user) {
        try {
          const bootstrap = await fetchWorkspaceBootstrapCached({
            slug,
            includeItems: false,
          });
          workspace = normalizeWorkspace(bootstrap);
          role = String(bootstrap?.role || "contributor");
          isPublicAccess = Boolean(bootstrap?.is_public_access);
          if (workspace) {
            setWorkspaceSession({
              workspace,
              role,
              isPublicAccess,
              billingBlocked: workspace.billing_access_allowed === false,
            });
          }
        } catch (error) {
          const status = getErrorStatus(error);
          if (status === 401 || status === 403) {
            setState((prev) => ({ ...prev, loading: false, user }));
            return;
          }
          throw error;
        }
      }

      const permissions = computePermissions(role, isPublicAccess);
      const messages = computeMessages(isPublicAccess, user);

      setState({
        workspace,
        user,
        role,
        isPublicAccess,
        loading: false,
        permissions,
        messages,
      });

      if (workspace?.slug) {
        trackWorkspaceView(workspace.slug).catch(() => {
          // Analytics should never break rendering.
        });
      }
    } catch (error) {
      console.error("Failed to load workspace context:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const trackWorkspaceView = async (slug) => {
    try {
      const sessionId = getOrCreateAnalyticsSessionId();
      if (!sessionId) return;

      await base44.functions.invoke("publicTrackWorkspaceView", {
        slug,
        session_id: sessionId,
        referrer: document.referrer || undefined,
      });
    } catch {
      // Ignore analytics failures.
    }
  };

  const refresh = () => {
    void loadWorkspaceContext();
  };

  return (
    <WorkspaceContext.Provider value={{ ...state, refresh }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

function computePermissions(role, isPublicAccess) {
  if (isPublicAccess) {
    return {
      canView: true,
      canCreateItems: false,
      canComment: false,
      canManageSettings: false,
      canModerateContent: false,
      isStaff: false,
      isAdmin: false,
    };
  }

  const isAdmin = isAdminRole(role);
  const isStaff = isAdmin;
  const isContributor = canContributeRole(role);

  return {
    canView: true,
    canCreateItems: isContributor,
    canComment: isContributor,
    canManageSettings: isAdmin,
    canModerateContent: isStaff,
    isStaff,
    isAdmin,
  };
}

function computeMessages(isPublicAccess, user) {
  if (isPublicAccess && !user) {
    return {
      loginPrompt: "Login to contribute feedback and interact with this workspace",
      accessDenied: null,
    };
  }

  if (isPublicAccess && user) {
    return {
      loginPrompt: null,
      accessDenied: "You don't have permission to contribute to this workspace. Contact the admin to request access.",
    };
  }

  return {
    loginPrompt: null,
    accessDenied: null,
  };
}
