import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Plus, LogOut, User } from 'lucide-react';
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
      const currentUser = await base44.auth.me();
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
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Select a Workspace
            </h1>
            <p className="text-slate-500">
              Choose a workspace to view feedback, roadmap, and support.
            </p>
          </div>
          {isTenantAdmin && (
            <Button onClick={() => setShowCreateModal(true)} className="bg-slate-900 hover:bg-slate-800">
              <Plus className="h-4 w-4 mr-2" />
              Create Workspace
            </Button>
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
      </main>
    </div>
  );
}