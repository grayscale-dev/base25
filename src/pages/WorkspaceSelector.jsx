import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Plus, LogOut, User, Settings, Shield, Key } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', slug: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Ensure user is authenticated for management portal
      let currentUser;
      try {
        currentUser = await base44.auth.me();
      } catch (error) {
        // Not authenticated, redirect to login
        base44.auth.redirectToLogin(window.location.origin + createPageUrl('WorkspaceSelector'));
        return;
      }
      
      setUser(currentUser);

      // Ensure user has a TenantMember record
      let tenantMembers = await base44.entities.TenantMember.filter({ user_id: currentUser.id });

      // If user doesn't have a TenantMember record, create one
      if (tenantMembers.length === 0) {
        // Get or create a default tenant
        let tenants = await base44.entities.Tenant.filter({});
        let tenant;

        if (tenants.length === 0) {
          // Create a default tenant if none exists
          tenant = await base44.entities.Tenant.create({
            name: 'Default Organization',
            slug: 'default',
            status: 'active'
          });
        } else {
          tenant = tenants[0];
        }

        // Create TenantMember - all authenticated users can create workspaces
        await base44.entities.TenantMember.create({
          tenant_id: tenant.id,
          user_id: currentUser.id,
          email: currentUser.email,
          is_tenant_admin: true, // All users can create workspaces (join-first model)
          status: 'active'
        });
      }

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

  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name || !newWorkspace.slug) return;
    
    setCreating(true);
    try {
      const tenantMembers = await base44.entities.TenantMember.filter({ user_id: user.id });
      const tenantMember = tenantMembers[0];
      
      const workspace = await base44.entities.Workspace.create({
        tenant_id: tenantMember.tenant_id,
        name: newWorkspace.name,
        slug: newWorkspace.slug,
        description: newWorkspace.description,
        visibility: 'restricted',
        support_enabled: true,
        status: 'active'
      });

      // Assign current user as admin
      await base44.entities.WorkspaceRole.create({
        workspace_id: workspace.id,
        user_id: user.id,
        email: user.email,
        role: 'admin',
        assigned_via: 'explicit'
      });

      setShowCreateModal(false);
      setNewWorkspace({ name: '', slug: '', description: '' });
      loadData();
    } catch (error) {
      console.error('Failed to create workspace:', error);
    } finally {
      setCreating(false);
    }
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
          
          <div className="flex items-center gap-3">

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
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Your Workspaces
              </h1>
              <p className="text-slate-500">
                Select a workspace to manage or create a new one to get started.
              </p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} className="bg-slate-900 hover:bg-slate-800">
              <Plus className="h-4 w-4 mr-2" />
              Create Workspace
            </Button>
          </div>
          

        </div>

        {workspaces.length === 0 ? (
          <EmptyState
            icon={Folder}
            title="No workspaces yet"
            description="Get started by creating your first workspace or wait to be invited to an existing one."
            action={() => setShowCreateModal(true)}
            actionLabel="Create Workspace"
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

        {/* Create Workspace Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Workspace Name</Label>
                <Input
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                  placeholder="e.g., Product Feedback"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Slug (URL-friendly)</Label>
                <Input
                  value={newWorkspace.slug}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="e.g., product-feedback"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  value={newWorkspace.description}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
                  placeholder="Brief description of this workspace"
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateWorkspace}
                  disabled={!newWorkspace.name || !newWorkspace.slug || creating}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {creating ? 'Creating...' : 'Create Workspace'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}