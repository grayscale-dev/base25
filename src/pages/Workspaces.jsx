import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Plus, LogOut, User, Link as LinkIcon } from 'lucide-react';
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

export default function Workspaces() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceRoles, setWorkspaceRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [joining, setJoining] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', slug: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Ensure user is authenticated
      let currentUser;
      try {
        currentUser = await base44.auth.me();
      } catch (error) {
        // Not authenticated, redirect to login
        base44.auth.redirectToLogin(window.location.origin + createPageUrl('Workspaces'));
        return;
      }
      
      setUser(currentUser);

      // Ensure user has a TenantMember record
      let tenantMembers = await base44.entities.TenantMember.filter({ user_id: currentUser.id });

      if (tenantMembers.length === 0) {
        // Get or create a default tenant
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
          is_tenant_admin: false,
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
    // Store selected workspace and navigate
    const role = workspaceRoles.find(r => r.workspace_id === workspace.id);
    sessionStorage.setItem('selectedWorkspaceId', workspace.id);
    sessionStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    sessionStorage.setItem('currentRole', role?.role || 'viewer');
    navigate(createPageUrl('Feedback'));
  };

  const handleJoinWorkflow = async () => {
    if (!joinLink.trim()) return;

    setJoining(true);
    try {
      // Parse the join link to extract workspace slug
      let slug;
      
      // Handle full URL or just slug
      if (joinLink.includes('workspace=')) {
        const url = new URL(joinLink);
        slug = url.searchParams.get('workspace');
      } else if (joinLink.startsWith('http')) {
        const url = new URL(joinLink);
        slug = url.searchParams.get('workspace');
      } else {
        // Assume it's just a slug
        slug = joinLink.trim();
      }

      if (!slug) {
        alert('Invalid join link or code');
        setJoining(false);
        return;
      }

      // Navigate to join page
      navigate(createPageUrl('JoinWorkspace') + `?workspace=${slug}`);
    } catch (error) {
      console.error('Failed to parse join link:', error);
      alert('Invalid join link format');
      setJoining(false);
    }
  };

  const handleCreateWorkflow = async () => {
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
      alert('Failed to create workflow. Please try again.');
    } finally {
      setCreating(false);
    }
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
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695ee36fb2c36c191b58c83e/678f5e1e6_create-a-svg-like-these-except-it-is-rock-on-symbo.png" 
                alt="Nexus" 
                className="h-8 w-8 object-contain"
              />
              <span className="text-lg font-semibold text-slate-900">nexus</span>
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
        {/* Actions */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Your Boards
              </h1>
              <p className="text-slate-500">
                {workspaces.length > 0 
                  ? `You have access to ${workspaces.length} board${workspaces.length === 1 ? '' : 's'}`
                  : 'Join or create a board to get started'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              onClick={() => setShowJoinModal(true)}
              size="lg"
              className="bg-slate-900 hover:bg-slate-800"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Join a Board
            </Button>
            <Button 
              onClick={() => setShowCreateModal(true)}
              size="lg"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create a Board
            </Button>
          </div>
        </div>

        {/* Boards Grid */}
        {workspaces.length > 0 && (
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

        {/* Join Board Modal */}
        <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Join a Board</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Invite Link or Code</Label>
                <Input
                  value={joinLink}
                  onChange={(e) => setJoinLink(e.target.value)}
                  placeholder="Paste invite link or enter board code"
                  className="mt-1.5"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoinWorkflow();
                  }}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Example: board-slug or full URL
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinLink('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleJoinWorkflow}
                  disabled={!joinLink.trim() || joining}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {joining ? 'Processing...' : 'Continue'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Board Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Board</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Board Name</Label>
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
                  placeholder="Brief description of this board"
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateWorkflow}
                  disabled={!newWorkspace.name || !newWorkspace.slug || creating}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {creating ? 'Creating...' : 'Create Board'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}