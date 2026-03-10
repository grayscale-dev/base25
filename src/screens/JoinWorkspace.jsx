import { useEffect, useState } from 'react';
import { useNavigate } from '@/lib/router';
import { Folder, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import PageLoadingState from '@/components/common/PageLoadingState';
import { StatePanel } from '@/components/common/StateDisplay';
import { setBoardSession } from '@/lib/board-session';
import { workspaceDefaultUrl } from '@/components/utils/boardUrl';

export default function JoinWorkspace() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [memberRole, setMemberRole] = useState('viewer');

  useEffect(() => {
    validateAndLoadWorkspace();
  }, []);

  const validateAndLoadWorkspace = async () => {
    try {
      // Get workspace slug from URL
      const urlParams = new URLSearchParams(window.location.search);
      const slug = urlParams.get('workspace');

      if (!slug) {
        setError('Invalid join link - no workspace specified');
        setLoading(false);
        return;
      }

      // Check if user is authenticated
      let currentUser;
      try {
        currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch {
        // Not authenticated - redirect to login and come back
        const returnUrl = window.location.pathname + window.location.search;
        base44.auth.redirectToLogin(window.location.origin + returnUrl);
        return;
      }

      // Load workspace
      const workspaces = await base44.entities.Board.filter({
        slug: slug,
        status: 'active'
      });

      if (workspaces.length === 0) {
        setError('Workspace not found or no longer active');
        setLoading(false);
        return;
      }

      const ws = workspaces[0];
      setWorkspace(ws);

      // Check if already a member
      const existingRoles = await base44.entities.BoardRole.filter({
        board_id: ws.id,
        user_id: currentUser.id
      });

      if (existingRoles.length > 0) {
        setAlreadyMember(true);
        setMemberRole(existingRoles[0].role || 'viewer');
      }

      // Validate if user is allowed to join
      if (existingRoles.length === 0) {
        const canJoin = await validateJoinPermission(ws, currentUser);
        if (!canJoin) {
          setError('You do not have permission to join this workspace');
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to validate join:', err);
      setError('Failed to load workspace. Please try again.');
      setLoading(false);
    }
  };

  const validateJoinPermission = async (ws, user) => {
    // If workspace is public, anyone can join
    if (ws.visibility === 'public') {
      return true;
    }

    // Check if there's an explicit BoardRole assigned to this email (pre-authorized)
    const emailRoles = await base44.entities.BoardRole.filter({
      board_id: ws.id,
      email: user.email
    });

    if (emailRoles.length > 0) {
      return true;
    }

    // For rule-based access, we rely on RLS during the join attempt.
    return true;
  };

  const handleJoinWorkspace = async () => {
    if (!workspace || !user) return;

    setJoining(true);
    try {
      // Check if there's a pre-existing role assignment by email
      const emailRoles = await base44.entities.BoardRole.filter({
        board_id: workspace.id,
        email: user.email
      });

      let assignedRole = 'viewer';
      
      if (emailRoles.length > 0) {
        // Update existing role with actual user_id
        const existingRole = emailRoles[0];
        assignedRole = existingRole.role;
        await base44.entities.BoardRole.update(existingRole.id, {
          user_id: user.id
        });
      } else {
        // Create new BoardRole
        await base44.entities.BoardRole.create({
          board_id: workspace.id,
          user_id: user.id,
          email: user.email,
          role: 'viewer',
          assigned_via: 'explicit'
        });
      }

      // Navigate to workspace with assigned role
      setBoardSession({ workspace, role: assignedRole });
      navigate(workspaceDefaultUrl(workspace.slug, assignedRole, false));
    } catch (err) {
      console.error('Failed to join workspace:', err);
      setError('Failed to join workspace. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleOpenWorkspace = () => {
    if (!workspace) return;

    const nextRole = memberRole || 'viewer';
    setBoardSession({ workspace, role: nextRole });
    navigate(workspaceDefaultUrl(workspace.slug, nextRole, false));
  };

  if (loading) {
    return <PageLoadingState fullHeight text="Validating invite..." className="bg-slate-50" />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <StatePanel
          tone="danger"
          icon={X}
          title="Unable to Join"
          description={error}
          action={() => navigate(createPageUrl('Workspaces'))}
          actionLabel="Back to Workspaces"
        />
      </div>
    );
  }

  if (alreadyMember && workspace) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <StatePanel
          tone="success"
          icon={Check}
          title="Already a Member"
          description={`You're already a member of ${workspace.name}. You can open this workspace now or return to your workspaces list.`}
          action={handleOpenWorkspace}
          actionLabel="Open Workspace"
          secondaryAction={() => navigate(createPageUrl('Workspaces'))}
          secondaryActionLabel="Back to Workspaces"
        />
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Folder className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Join Workspace
          </h1>
          <p className="text-slate-500">
            You've been invited to join
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            {workspace.name}
          </h2>
          {workspace.description && (
            <p className="text-sm text-slate-600">
              {workspace.description}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleJoinWorkspace}
            disabled={joining}
            className="w-full bg-slate-900 hover:bg-slate-800"
          >
            {joining ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Join Workspace
              </>
            )}
          </Button>
          <Button
            onClick={() => navigate(createPageUrl('Workspaces'))}
            variant="outline"
            className="w-full"
            disabled={joining}
          >
            Cancel
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-6">
          By joining, you'll be able to view and contribute to workspace items.
        </p>
      </div>
    </div>
  );
}
