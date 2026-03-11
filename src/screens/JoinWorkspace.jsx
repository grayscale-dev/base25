"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router";
import { Check, Folder, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import PageLoadingState from "@/components/common/PageLoadingState";
import { StatePanel } from "@/components/common/StateDisplay";
import { setWorkspaceSession } from "@/lib/workspace-session";
import { workspaceDefaultUrl } from "@/components/utils/workspaceUrl";
import {
  ensureWorkspaceMembership,
  getWorkspaceRole,
  joinWorkspaceWithCode,
  resolveWorkspaceJoinCandidate,
} from "@/lib/workspace-join";

const getErrorStatus = (error) => {
  if (!error) return null;
  return error.status ?? error.context?.status ?? error.response?.status ?? null;
};

export default function JoinWorkspace() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [memberRole, setMemberRole] = useState("contributor");
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    void validateAndLoadWorkspace();
  }, []);

  const validateAndLoadWorkspace = async () => {
    try {
      setLoading(true);
      setError("");

      const urlParams = new URLSearchParams(window.location.search);
      const slug = urlParams.get("workspace");

      if (!slug) {
        setError("Invalid join link - no workspace specified.");
        return;
      }

      let currentUser;
      try {
        currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch {
        const returnUrl = window.location.pathname + window.location.search;
        await base44.auth.redirectToLogin(window.location.origin + returnUrl);
        return;
      }

      const candidate = await resolveWorkspaceJoinCandidate(slug);
      if (candidate.status === "not_found") {
        setError("Workspace not found or no longer active.");
        return;
      }
      if (candidate.status === "auth_required") {
        const returnUrl = window.location.pathname + window.location.search;
        await base44.auth.redirectToLogin(window.location.origin + returnUrl);
        return;
      }
      if (candidate.status === "requires_code") {
        setAccessRequired(true);
        setWorkspace({ slug, name: slug });
        return;
      }

      if (!candidate.workspace) {
        setError("Workspace not found or no longer active.");
        return;
      }

      setWorkspace(candidate.workspace);

      const role = await getWorkspaceRole(candidate.workspace.id, currentUser.id);
      if (role) {
        setAlreadyMember(true);
        setMemberRole(role.role || "contributor");
      }
    } catch (err) {
      console.error("Failed to validate join:", err);
      setError("Failed to load workspace. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWorkspace = async () => {
    if (!workspace || !user) return;

    setJoining(true);
    setError("");
    try {
      const membership = await ensureWorkspaceMembership({ workspace, user });
      setWorkspaceSession({ workspace, role: membership.role });
      navigate(workspaceDefaultUrl(workspace.slug, membership.role, false));
    } catch (err) {
      console.error("Failed to join workspace:", err);
      setError("Failed to join workspace. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleJoinWithAccessCode = async () => {
    if (!workspace?.slug || !accessCode.trim()) return;

    setJoining(true);
    setError("");
    try {
      const joined = await joinWorkspaceWithCode({
        slug: workspace.slug,
        accessCode,
      });
      if (!joined.workspace?.slug) {
        setError("Unable to join workspace with that code.");
        return;
      }
      const nextRole = joined.role || "contributor";
      setWorkspaceSession({ workspace: joined.workspace, role: nextRole });
      navigate(workspaceDefaultUrl(joined.workspace.slug, nextRole, false));
    } catch (joinError) {
      const status = getErrorStatus(joinError);
      if (status === 403) {
        setError("Invalid or expired access code.");
      } else if (status === 404) {
        setError("Workspace not found.");
      } else {
        console.error("Failed to join with access code:", joinError);
        setError("Unable to join workspace. Please try again.");
      }
    } finally {
      setJoining(false);
    }
  };

  const handleOpenWorkspace = () => {
    if (!workspace) return;
    const nextRole = memberRole || "contributor";
    setWorkspaceSession({ workspace, role: nextRole });
    navigate(workspaceDefaultUrl(workspace.slug, nextRole, false));
  };

  if (loading) {
    return <PageLoadingState fullHeight text="Validating invite..." className="bg-slate-50" />;
  }

  if (error && !accessRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <StatePanel
          tone="danger"
          icon={X}
          title="Unable to Join"
          description={error}
          action={() => navigate(createPageUrl("Workspaces"))}
          actionLabel="Back to Workspaces"
        />
      </div>
    );
  }

  if (alreadyMember && workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <StatePanel
          tone="success"
          icon={Check}
          title="Already a Member"
          description={`You're already a member of ${workspace.name}. You can open this workspace now or return to your workspaces list.`}
          action={handleOpenWorkspace}
          actionLabel="Open Workspace"
          secondaryAction={() => navigate(createPageUrl("Workspaces"))}
          secondaryActionLabel="Back to Workspaces"
        />
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  if (accessRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900">
              <Folder className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-slate-900">Enter Access Code</h1>
            <p className="text-slate-500">This workspace is restricted. Enter a valid code to join.</p>
          </div>

          <div className="space-y-3">
            <Input
              value={accessCode}
              onChange={(event) => {
                setAccessCode(event.target.value.toUpperCase());
                setError("");
              }}
              className="text-center font-mono uppercase tracking-[0.3em]"
              placeholder="Access code"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleJoinWithAccessCode();
                }
              }}
            />
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </div>

          <div className="mt-4 space-y-2">
            <Button
              onClick={handleJoinWithAccessCode}
              disabled={joining || !accessCode.trim()}
              className="w-full bg-slate-900 hover:bg-slate-800"
            >
              {joining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Workspace"
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={joining}
              onClick={() => navigate(createPageUrl("Workspaces"))}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900">
            <Folder className="h-8 w-8 text-white" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Join Workspace</h1>
          <p className="text-slate-500">You've been invited to join</p>
        </div>

        <div className="mb-6 rounded-xl bg-slate-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-slate-900">{workspace.name}</h2>
          {workspace.description ? <p className="text-sm text-slate-600">{workspace.description}</p> : null}
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleJoinWorkspace}
            disabled={joining}
            className="w-full bg-slate-900 hover:bg-slate-800"
          >
            {joining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Join Workspace
              </>
            )}
          </Button>
          <Button
            onClick={() => navigate(createPageUrl("Workspaces"))}
            variant="outline"
            className="w-full"
            disabled={joining}
          >
            Cancel
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          By joining, you'll be able to view and contribute to workspace items.
        </p>
      </div>
    </div>
  );
}
