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
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
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

      // Check if user is tenant admin
      const tenantMembers = await base44.entities.TenantMember.filter({ user_id: currentUser.id });
      const tenantAdmin = tenantMembers.find(tm => tm.is_tenant_admin);
      setIsTenantAdmin(!!tenantAdmin);

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
            {isTenantAdmin && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                <Shield className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">Tenant Admin</span>
              </div>
            )}
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg mb-4">
            <Settings className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">Admin Portal - Management Access</span>
          </div>
          
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Workspace Management
              </h1>
              <p className="text-slate-500">
                Select a workspace to manage settings, moderate content, and configure the portal.
              </p>
            </div>
            {isTenantAdmin && (
              <Button onClick={() => setShowCreateModal(true)} className="bg-slate-900 hover:bg-slate-800">
                <Plus className="h-4 w-4 mr-2" />
                Create Workspace
              </Button>
            )}
          </div>
          
          {isTenantAdmin && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-purple-900 mb-1">Full Administrative Access</h3>
                  <p className="text-sm text-purple-700 mb-3">
                    As a tenant admin, you can create workspaces, manage all settings, configure permissions, and moderate all content across the platform.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-purple-600">
                      <Plus className="h-4 w-4" />
                      <span>Create & delete workspaces</span>
                    </div>
                    <div className="flex items-center gap-2 text-purple-600">
                      <Settings className="h-4 w-4" />
                      <span>Configure workspace settings</span>
                    </div>
                    <div className="flex items-center gap-2 text-purple-600">
                      <Shield className="h-4 w-4" />
                      <span>Manage user access & roles</span>
                    </div>
                    <div className="flex items-center gap-2 text-purple-600">
                      <Key className="h-4 w-4" />
                      <span>API tokens & integrations</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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