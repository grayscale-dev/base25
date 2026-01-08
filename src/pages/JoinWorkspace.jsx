import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Check, X, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function JoinWorkspace() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [alreadyMember, setAlreadyMember] = useState(false);

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
      } catch (authError) {
        // Not authenticated - redirect to login and come back
        const returnUrl = window.location.pathname + window.location.search;
        base44.auth.redirectToLogin(window.location.origin + returnUrl);
        return;
      }

      // Load workspace
      const workspaces = await base44.entities.Workspace.filter({
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
      const existingRoles = await base44.entities.WorkspaceRole.filter({
        workspace_id: ws.id,
        user_id: currentUser.id
      });

      if (existingRoles.length > 0) {
        setAlreadyMember(true);
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

    // Check access rules
    const rules = await base44.entities.AccessRule.filter({
      workspace_id: ws.id,
      is_active: true
    });

    for (const rule of rules) {
      if (matchesAccessRule(user.email, rule)) {
        return true;
      }
    }

    // If no rules matched and workspace is restricted, deny access
    return false;
  };

  const matchesAccessRule = (email, rule) => {
    if (rule.pattern_type === 'exact') {
      return email === rule.pattern;
    } else if (rule.pattern_type === 'domain') {
      const domain = email.split('@')[1];
      return rule.pattern === domain || rule.pattern === `@${domain}`;
    } else if (rule.pattern_type === 'substring') {
      return email.includes(rule.pattern);
    }
    return false;
  };

  const handleJoinWorkspace = async () => {
    if (!workspace || !user) return;

    setJoining(true);
    try {
      // Create WorkspaceRole to add them as a member
      await base44.entities.WorkspaceRole.create({
        workspace_id: workspace.id,
        user_id: user.id,
        email: user.email,
        role: 'viewer',
        assigned_via: 'explicit'
      });

      // Ensure user has TenantMember record
      const tenantMembers = await base44.entities.TenantMember.filter({
        user_id: user.id,
        tenant_id: workspace.tenant_id
      });

      if (tenantMembers.length === 0) {
        await base44.entities.TenantMember.create({
          tenant_id: workspace.tenant_id,
          user_id: user.id,
          email: user.email,
          is_tenant_admin: false,
          status: 'active'
        });
      }

      // Navigate to workspace in customer view
      sessionStorage.setItem('isPublicAccess', 'true');
      sessionStorage.setItem('selectedWorkspaceId', workspace.id);
      sessionStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
      sessionStorage.setItem('currentRole', 'viewer');
      navigate(createPageUrl('Feedback'));
    } catch (err) {
      console.error('Failed to join workspace:', err);
      setError('Failed to join workspace. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleOpenWorkspace = () => {
    if (!workspace) return;

    sessionStorage.setItem('isPublicAccess', 'true');
    sessionStorage.setItem('selectedWorkspaceId', workspace.id);
    sessionStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    sessionStorage.setItem('currentRole', 'viewer');
    navigate(createPageUrl('Feedback'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Validating invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Unable to Join</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <Button
            onClick={() => navigate(createPageUrl('Landing'))}
            variant="outline"
            className="w-full"
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (alreadyMember && workspace) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Already a Member</h1>
          <p className="text-slate-600 mb-2">
            You're already a member of <strong>{workspace.name}</strong>
          </p>
          <p className="text-sm text-slate-500 mb-6">
            You can access this workspace from your customer portal.
          </p>
          <div className="space-y-3">
            <Button
              onClick={handleOpenWorkspace}
              className="w-full bg-slate-900 hover:bg-slate-800"
            >
              Open Workspace
            </Button>
            <Button
              onClick={() => navigate(createPageUrl('Landing'))}
              variant="outline"
              className="w-full"
            >
              Go to Home
            </Button>
          </div>
        </div>
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
            onClick={() => navigate(createPageUrl('Landing'))}
            variant="outline"
            className="w-full"
            disabled={joining}
          >
            Cancel
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-6">
          By joining, you'll be able to view feedback, roadmap, and submit your own feedback.
        </p>
      </div>
    </div>
  );
}