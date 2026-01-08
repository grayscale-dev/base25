import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Plus, LogOut, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import WorkspaceCard from '@/components/workspace/WorkspaceCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';

export default function CustomerHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Check if user is authenticated
      let currentUser;
      try {
        currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (authError) {
        // Not authenticated - redirect to landing
        navigate(createPageUrl('Landing'));
        return;
      }

      // Load workspaces user is a member of
      const roles = await base44.entities.WorkspaceRole.filter({ 
        user_id: currentUser.id 
      });

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
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorkspace = (workspace) => {
    // Navigate to workspace in customer view
    sessionStorage.setItem('isPublicAccess', 'true');
    sessionStorage.setItem('selectedWorkspaceId', workspace.id);
    sessionStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    sessionStorage.setItem('currentRole', 'viewer');
    navigate(createPageUrl('Feedback'));
  };

  const handleLogout = () => {
    sessionStorage.clear();
    base44.auth.logout();
  };

  const handleSwitchToManagement = async () => {
    try {
      const currentUser = await base44.auth.me();
      
      // Ensure user has TenantMember record
      const tenantMembers = await base44.entities.TenantMember.filter({ 
        user_id: currentUser.id 
      });

      if (tenantMembers.length === 0) {
        // Get or create default tenant
        let tenants = await base44.entities.Tenant.filter({});
        let tenant;

        if (tenants.length === 0) {
          tenant = await base44.entities.Tenant.create({
            name: 'Default Organization',
            slug: 'default',
            status: 'active'
          });
        } else {
          tenant = tenants[0];
        }

        await base44.entities.TenantMember.create({
          tenant_id: tenant.id,
          user_id: currentUser.id,
          email: currentUser.email,
          is_tenant_admin: true,
          status: 'active'
        });
      }

      // Navigate to management portal
      navigate(createPageUrl('WorkspaceSelector'));
    } catch (error) {
      console.error('Failed to switch to management:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading your workspaces..." />
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
            <span className="text-lg font-semibold text-slate-900">Customer Portal</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSwitchToManagement}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Management Portal
            </Button>

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
            Your Workspaces
          </h1>
          <p className="text-slate-500">
            Access workspaces you've joined to view feedback, roadmap, and more.
          </p>
        </div>

        {workspaces.length === 0 ? (
          <EmptyState
            icon={Folder}
            title="No workspaces yet"
            description="You haven't joined any workspaces yet. Use an invite link to join a workspace."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                role="viewer"
                onClick={() => handleSelectWorkspace(workspace)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}