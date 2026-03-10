import { useEffect, useState } from 'react';
import { useNavigate } from '@/lib/router';
import { Plus, LogOut, Link as LinkIcon } from 'lucide-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
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
import { workspaceDefaultUrl } from '@/components/utils/workspaceUrl';
import WorkspaceCard from '@/components/workspace/WorkspaceCard';
import PageLoadingState from '@/components/common/PageLoadingState';
import { PageHeader, PageShell } from '@/components/common/PageScaffold';
import { StatePanel } from '@/components/common/StateDisplay';
import { setWorkspaceSession } from '@/lib/workspace-session';

const getErrorStatus = (error) => {
  if (!error) return null;
  return error.status ?? error.context?.status ?? null;
};

export default function Workspaces() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceRoles, setWorkspaceRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [joinLinkError, setJoinLinkError] = useState('');
  const [joining, setJoining] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', slug: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: null, message: '' });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!showCreateModal || !newWorkspace.slug) {
      setSlugStatus({ checking: false, available: null, message: '' });
      return;
    }

    const normalizedSlug = newWorkspace.slug.trim();
    if (!normalizedSlug) {
      setSlugStatus({ checking: false, available: null, message: '' });
      return;
    }

    const handle = setTimeout(async () => {
      setSlugStatus({ checking: true, available: null, message: '' });
      try {
        const { data } = await base44.functions.invoke(
          'checkWorkspaceSlug',
          { slug: normalizedSlug },
          { authMode: 'anon' }
        );
        if (data?.available) {
          setSlugStatus({ checking: false, available: true, message: 'Slug is available' });
        } else {
          setSlugStatus({ checking: false, available: false, message: 'Slug is already in use' });
        }
      } catch (error) {
        const status = getErrorStatus(error);
        if (status === 401) {
          setSlugStatus({
            checking: false,
            available: null,
            message: 'Session expired. Sign in again to continue.',
          });
          return;
        }
        console.error('Failed to check slug:', error);
        setSlugStatus({ checking: false, available: null, message: 'Unable to check slug' });
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [newWorkspace.slug, showCreateModal]);

  const loadData = async () => {
    try {
      setLoadError('');
      // Ensure user is authenticated
      let currentUser;
      try {
        currentUser = await base44.auth.me();
      } catch {
        window.location.replace(createPageUrl('Home'));
        return;
      }
      
      setUser(currentUser);

      // Load workspace roles
      const roles = await base44.entities.WorkspaceRole.filter({ 
        user_id: currentUser.id 
      });
      setWorkspaceRoles(roles);

      if (roles.length > 0) {
        const workspaceIds = [...new Set(roles.map(r => r.workspace_id).filter(Boolean))];
        const workspacesData = await Promise.all(
          workspaceIds.map(async (id) => {
            const results = await base44.entities.Workspace.filter({ id });
            return results[0];
          })
        );
        const activeWorkspaces = workspacesData.filter((workspace) => workspace && workspace.status === 'active');
        setWorkspaces(activeWorkspaces);
      } else {
        setWorkspaces([]);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      setLoadError('Unable to load your workspaces right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorkspace = (workspace) => {
    // Store selected workspace and navigate to canonical workspace route
    const workspaceRole = workspaceRoles.find((entry) => entry.workspace_id === workspace.id);
    const nextRole = workspaceRole?.role || 'viewer';
    setWorkspaceSession({ workspace, role: nextRole });
    navigate(workspaceDefaultUrl(workspace.slug, nextRole, false));
  };

  const handleJoinWorkspace = async () => {
    if (!joinLink.trim()) return;

    setJoinLinkError('');
    setJoining(true);
    try {
      // Parse the join link to extract workspace slug
      let slug;
      
      // Handle full URL or just slug
      if (joinLink.includes('workspace=')) {
        const url = new URL(joinLink, window.location.origin);
        slug = url.searchParams.get('workspace');
      } else if (joinLink.startsWith('http')) {
        const url = new URL(joinLink);
        slug = url.searchParams.get('workspace');
        if (!slug) {
          const parts = url.pathname.split('/').filter(Boolean);
          if (parts[0] === 'workspace') {
            slug = parts[1];
          }
        }
      } else {
        const parts = joinLink.trim().split('/').filter(Boolean);
        if (parts[0] === 'workspace') {
          slug = parts[1];
        } else {
          slug = joinLink.trim();
        }
      }

      if (!slug) {
        setJoinLinkError('Unable to find a workspace slug in that link. Use a workspace invite URL or workspace slug.');
        setJoining(false);
        return;
      }

      navigate(`${createPageUrl('JoinWorkspace')}?workspace=${slug}`);
    } catch (error) {
      console.error('Failed to parse join link:', error);
      setJoinLinkError('That invite link is invalid. Check the URL and try again.');
      setJoining(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name || !newWorkspace.slug) return;
    
    setCreateError('');
    setCreating(true);
    try {
      const { data: createdWorkspace } = await base44.functions.invoke('createWorkspace', {
        name: newWorkspace.name,
        slug: newWorkspace.slug,
        description: newWorkspace.description,
        visibility: 'restricted'
      }, { authMode: 'user' });

      setShowCreateModal(false);
      setNewWorkspace({ name: '', slug: '', description: '' });
      if (createdWorkspace?.slug) {
        setWorkspaceSession({ workspace: createdWorkspace, role: 'admin' });
        navigate(workspaceDefaultUrl(createdWorkspace.slug, 'admin', false));
        return;
      }
      loadData();
    } catch (error) {
      const status = getErrorStatus(error);
      if (status === 401) {
        await base44.auth.redirectToLogin(window.location.origin + createPageUrl('Workspaces'));
        return;
      }
      console.error('Failed to create workspace:', error);
      setCreateError('Failed to create workspace. Please review the values and try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    base44.auth.logout(window.location.origin + createPageUrl('Home'));
  };

  const getRoleForWorkspace = (workspaceId) => {
    const role = workspaceRoles.find((entry) => entry.workspace_id === workspaceId);
    return role?.role || 'viewer';
  };

  if (loading) {
    return <PageLoadingState fullHeight text="Loading your workspaces..." className="bg-slate-50" />;
  }

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <img 
                src="/base25-logo.png" 
                alt="base25" 
                className="h-8 w-8 object-contain"
              />
              <span className="text-lg font-semibold text-slate-900">base25</span>
            </div>
          
          <div className="flex items-center gap-3">
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
        <PageShell className="space-y-8">
          {loadError ? (
            <StatePanel
              tone="danger"
              title="Unable to load workspaces"
              description={loadError}
              action={() => {
                setLoading(true);
                loadData();
              }}
              actionLabel="Retry"
            />
          ) : (
            <>
              <PageHeader
                title="Your Workspaces"
                description={
                  workspaces.length > 0
                    ? `You have access to ${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}.`
                    : 'Join an existing workspace or create your first workspace to get started.'
                }
                actions={(
                  <>
                    <Button
                      onClick={() => setShowJoinModal(true)}
                      size="lg"
                      className="bg-slate-900 hover:bg-slate-800"
                    >
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Join a Workspace
                    </Button>
                    <Button
                      onClick={() => {
                        setCreateError('');
                        setShowCreateModal(true);
                      }}
                      size="lg"
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create a Workspace
                    </Button>
                  </>
                )}
              />

              {/* Workspaces Grid */}
              {workspaces.length > 0 ? (
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
              ) : (
                <StatePanel
                  title="No workspaces yet"
                  description="Use one of the actions above to join a workspace invite or create a new workspace for your team."
                  tone="neutral"
                  action={() => setShowCreateModal(true)}
                  actionLabel="Create a Workspace"
                  secondaryAction={() => setShowJoinModal(true)}
                  secondaryActionLabel="Join a Workspace"
                />
              )}
            </>
          )}

          {/* Join Workspace Modal */}
          <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Join a Workspace</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
              <div>
                <Label>Workspace Link</Label>
                <Input
                  value={joinLink}
                  onChange={(e) => {
                    setJoinLink(e.target.value);
                    setJoinLinkError('');
                  }}
                  placeholder="Paste invite link or workspace slug"
                  className="mt-1.5"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoinWorkspace();
                  }}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Example: https://your-domain.com/join-workspace?workspace=your-workspace
                </p>
                {joinLinkError ? (
                  <p className="text-xs text-rose-600 mt-2">{joinLinkError}</p>
                ) : null}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinLink('');
                    setJoinLinkError('');
                  }}
                >
                  Cancel
                </Button>
                  <Button 
                    onClick={handleJoinWorkspace}
                    disabled={!joinLink.trim() || joining}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    {joining ? 'Joining...' : 'Continue'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Create Workspace Modal */}
          <Dialog
            open={showCreateModal}
            onOpenChange={(open) => {
              if (!open) {
                setCreateError('');
              }
              setShowCreateModal(open);
            }}
          >
            <DialogContent className="max-w-md">
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Create New Workspace</DialogTitle>
                </DialogHeader>
                <div>
                  <Label>Workspace Name</Label>
                  <Input
                    value={newWorkspace.name}
                    onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                    placeholder="e.g., Product Team"
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
                  {slugStatus.message && (
                    <p className={`text-xs mt-2 ${slugStatus.available === false ? 'text-red-600' : 'text-slate-500'}`}>
                      {slugStatus.checking ? 'Checking...' : slugStatus.message}
                    </p>
                  )}
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
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCreateError('');
                      setShowCreateModal(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateWorkspace}
                    disabled={!newWorkspace.name || !newWorkspace.slug || creating || slugStatus.available === false || slugStatus.checking}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    {creating ? 'Creating...' : 'Create Workspace'}
                  </Button>
                </div>
                {createError ? (
                  <p className="text-xs text-rose-600">{createError}</p>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </PageShell>
      </main>
    </div>
    </ProtectedRoute>
  );
}
