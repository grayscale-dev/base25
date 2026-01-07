import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Plus, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import WorkspaceCard from '@/components/workspace/WorkspaceCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';

export default function WorkspaceSelector() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceRoles, setWorkspaceRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load workspace roles
      const roles = await base44.entities.WorkspaceRole.filter({ 
        user_id: currentUser.id 
      });
      setWorkspaceRoles(roles);

      if (roles.length > 0) {
        const workspaceIds = [...new Set(roles.map(r => r.workspace_id))];
        const workspacesData = await Promise.all(
          workspaceIds.map(async (id) => {
            const results = await base44.entities.Workspace.filter({ id });
            return results[0];
          })
        );
        const activeWorkspaces = workspacesData.filter(w => w && w.status === 'active');
        setWorkspaces(activeWorkspaces);

        // Auto-redirect if only one workspace
        if (activeWorkspaces.length === 1) {
          handleSelectWorkspace(activeWorkspaces[0]);
          return;
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorkspace = (workspace) => {
    // Store selected workspace in sessionStorage
    sessionStorage.setItem('selectedWorkspaceId', workspace.id);
    sessionStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    const role = workspaceRoles.find(r => r.workspace_id === workspace.id);
    sessionStorage.setItem('currentRole', role?.role || 'viewer');
    navigate(createPageUrl('Feedback'));
  };

  const handleLogout = () => {
    sessionStorage.clear();
    base44.auth.logout();
  };

  const getRoleForWorkspace = (workspaceId) => {
    const role = workspaceRoles.find(r => r.workspace_id === workspaceId);
    return role?.role || 'viewer';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading workspaces..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-xl">
              <Folder className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-slate-900">Workspaces</span>
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="h-4 w-4" />
                <span>{user.email}</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-slate-600"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Select a Workspace
          </h1>
          <p className="text-slate-500">
            Choose a workspace to view feedback, roadmap, and support.
          </p>
        </div>

        {workspaces.length === 0 ? (
          <EmptyState
            icon={Folder}
            title="No workspaces available"
            description="You don't have access to any workspaces yet. Contact your administrator to request access."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                role={getRoleForWorkspace(workspace.id)}
                onClick={() => handleSelectWorkspace(workspace)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}