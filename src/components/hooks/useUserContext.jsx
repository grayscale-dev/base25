import { useState, useEffect, createContext, useContext } from 'react';
import { base44 } from '@/api/base44Client';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceRoles, setWorkspaceRoles] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    loadUserContext();
  }, []);

  const loadUserContext = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load tenant memberships
      const membershipData = await base44.entities.TenantMember.filter({ 
        user_id: currentUser.id 
      });
      
      if (membershipData.length > 0) {
        const tenantIds = [...new Set(membershipData.map(m => m.tenant_id))];
        const tenantsData = await Promise.all(
          tenantIds.map(id => base44.entities.Tenant.filter({ id }))
        );
        setTenants(tenantsData.flat().filter(t => t.status === 'active'));
      }

      // Load workspace roles
      const rolesData = await base44.entities.WorkspaceRole.filter({ 
        user_id: currentUser.id 
      });
      setWorkspaceRoles(rolesData);

      // Load accessible workspaces
      if (rolesData.length > 0) {
        const workspaceIds = [...new Set(rolesData.map(r => r.workspace_id))];
        const workspacesData = await Promise.all(
          workspaceIds.map(id => base44.entities.Workspace.filter({ id }))
        );
        const activeWorkspaces = workspacesData.flat().filter(w => w.status === 'active');
        setWorkspaces(activeWorkspaces);

        // Auto-select if only one workspace
        if (activeWorkspaces.length === 1) {
          const ws = activeWorkspaces[0];
          const role = rolesData.find(r => r.workspace_id === ws.id);
          setCurrentWorkspace(ws);
          setCurrentRole(role?.role || 'viewer');
        }
      }

      setInitialized(true);
    } catch (error) {
      console.error('Failed to load user context:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectWorkspace = (workspace) => {
    setCurrentWorkspace(workspace);
    const role = workspaceRoles.find(r => r.workspace_id === workspace.id);
    setCurrentRole(role?.role || 'viewer');
  };

  const hasPermission = (permission) => {
    if (!currentRole) return false;
    
    const permissions = {
      viewer: ['view_feedback', 'view_roadmap', 'view_own_tickets'],
      contributor: ['view_feedback', 'view_roadmap', 'view_own_tickets', 'create_feedback', 'create_ticket', 'attach_files'],
      support: ['view_feedback', 'view_roadmap', 'view_own_tickets', 'create_feedback', 'create_ticket', 'attach_files', 
                'respond_feedback', 'edit_feedback_meta', 'manage_roadmap', 'manage_support'],
      admin: ['view_feedback', 'view_roadmap', 'view_own_tickets', 'create_feedback', 'create_ticket', 'attach_files',
              'respond_feedback', 'edit_feedback_meta', 'manage_roadmap', 'manage_support',
              'manage_access', 'manage_api', 'view_api_docs', 'manage_settings']
    };
    
    return permissions[currentRole]?.includes(permission) || false;
  };

  const isStaff = () => ['support', 'admin'].includes(currentRole);
  const isAdmin = () => currentRole === 'admin';

  const value = {
    user,
    tenants,
    workspaces,
    workspaceRoles,
    currentWorkspace,
    currentRole,
    loading,
    initialized,
    selectWorkspace,
    hasPermission,
    isStaff,
    isAdmin,
    refresh: loadUserContext
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
}

export default useUserContext;