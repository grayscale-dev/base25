"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router";
import { Link as LinkIcon, Loader2, Plus, Settings } from "lucide-react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { workspaceDefaultUrl } from "@/components/utils/workspaceUrl";
import WorkspaceCard from "@/components/workspace/WorkspaceCard";
import PageLoadingState from "@/components/common/PageLoadingState";
import PageEmptyState from "@/components/common/PageEmptyState";
import { PageHeader, PageShell } from "@/components/common/PageScaffold";
import { StatePanel } from "@/components/common/StateDisplay";
import { setWorkspaceSession } from "@/lib/workspace-session";
import AccountSettingsPanel from "@/components/workspace/AccountSettingsPanel";
import {
  ensureWorkspaceMembership,
  joinWorkspaceWithCode,
  parseWorkspaceSlug,
  resolveWorkspaceJoinCandidate,
} from "@/lib/workspace-join";
import { fetchListMyWorkspacesCached } from "@/lib/workspace-queries";

const EMPTY_SLUG_STATUS = { checking: false, available: null, message: "" };

const getErrorStatus = (error) => {
  if (!error) return null;
  return error.status ?? error.context?.status ?? error.response?.status ?? null;
};

export default function Workspaces() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinStep, setJoinStep] = useState("link");
  const [joinLink, setJoinLink] = useState("");
  const [joinSlug, setJoinSlug] = useState("");
  const [joinAccessCode, setJoinAccessCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    slug: "",
    description: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [slugStatus, setSlugStatus] = useState(EMPTY_SLUG_STATUS);
  const [showAccountSettings, setShowAccountSettings] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!showCreateModal) {
      setSlugStatus(EMPTY_SLUG_STATUS);
      return;
    }

    const normalizedSlug = newWorkspace.slug.trim();
    if (!normalizedSlug) {
      setSlugStatus(EMPTY_SLUG_STATUS);
      return;
    }

    const handle = setTimeout(async () => {
      setSlugStatus({ checking: true, available: null, message: "Checking slug..." });
      try {
        const { data } = await base44.functions.invoke(
          "checkWorkspaceSlug",
          { slug: normalizedSlug },
          { authMode: "user" }
        );

        if (data?.available) {
          setSlugStatus({
            checking: false,
            available: true,
            message: "Slug is available.",
          });
        } else {
          setSlugStatus({
            checking: false,
            available: false,
            message: "Slug is already in use.",
          });
        }
      } catch (error) {
        console.error("Failed to check slug:", error);
        setSlugStatus({
          checking: false,
          available: null,
          message: "Unable to validate slug right now.",
        });
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [newWorkspace.slug, showCreateModal]);

  const loadData = async () => {
    try {
      setLoadError("");

      let currentUser;
      try {
        currentUser = await base44.auth.me();
      } catch {
        await base44.auth.redirectToLogin(
          window.location.origin + createPageUrl("Workspaces")
        );
        return;
      }

      setUser(currentUser);

      const listedWorkspaces = await fetchListMyWorkspacesCached();
      setWorkspaces(Array.isArray(listedWorkspaces) ? listedWorkspaces : []);
    } catch (error) {
      console.error("Failed to load workspaces:", error);
      setLoadError("Unable to load your workspaces right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetJoinState = () => {
    setJoinStep("link");
    setJoinLink("");
    setJoinSlug("");
    setJoinAccessCode("");
    setJoinError("");
    setJoining(false);
  };

  const resetCreateState = () => {
    setCreateError("");
    setNewWorkspace({ name: "", slug: "", description: "" });
    setSlugStatus(EMPTY_SLUG_STATUS);
    setCreating(false);
  };

  const ensureCurrentUser = async () => {
    if (user) return user;
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    return currentUser;
  };

  const openWorkspace = (workspace, role) => {
    setWorkspaceSession({ workspace, role });
    navigate(workspaceDefaultUrl(workspace.slug, role, false));
  };

  const handleJoinAccessibleWorkspace = async (workspace) => {
    const currentUser = await ensureCurrentUser();
    const membership = await ensureWorkspaceMembership({ workspace, user: currentUser });
    openWorkspace(workspace, membership.role || "contributor");
  };

  const handleResolveJoinLink = async () => {
    if (!joinLink.trim()) return;

    setJoinError("");
    setJoining(true);
    try {
      const slug = parseWorkspaceSlug(joinLink);
      if (!slug) {
        setJoinError(
          "Unable to find a workspace slug in that link. Use a workspace invite URL or workspace slug."
        );
        return;
      }

      const candidate = await resolveWorkspaceJoinCandidate(slug);
      if (candidate.status === "auth_required") {
        await base44.auth.redirectToLogin(window.location.origin + createPageUrl("Workspaces"));
        return;
      }
      if (candidate.status === "not_found") {
        setJoinError("Workspace not found. Check the URL and try again.");
        return;
      }
      if (candidate.status === "requires_code") {
        setJoinSlug(slug);
        setJoinStep("code");
        return;
      }

      if (candidate.workspace) {
        await handleJoinAccessibleWorkspace(candidate.workspace);
        setShowJoinModal(false);
        resetJoinState();
      }
    } catch (error) {
      console.error("Failed to resolve join link:", error);
      setJoinError("Unable to process that workspace link right now.");
    } finally {
      setJoining(false);
    }
  };

  const handleJoinWithCode = async () => {
    if (!joinSlug || !joinAccessCode.trim()) return;

    setJoinError("");
    setJoining(true);
    try {
      const joined = await joinWorkspaceWithCode({
        slug: joinSlug,
        accessCode: joinAccessCode,
      });

      if (!joined.workspace?.slug) {
        setJoinError("Unable to join this workspace with that access code.");
        return;
      }

      openWorkspace(joined.workspace, joined.role || "contributor");
      setShowJoinModal(false);
      resetJoinState();
    } catch (error) {
      const status = getErrorStatus(error);
      if (status === 401) {
        await base44.auth.redirectToLogin(window.location.origin + createPageUrl("Workspaces"));
        return;
      }
      if (status === 403) {
        setJoinError("Invalid or expired access code. Please try again.");
        return;
      }
      if (status === 404) {
        setJoinError("Workspace not found. Check the URL and try again.");
        return;
      }
      console.error("Failed to join workspace with code:", error);
      setJoinError("Unable to join workspace. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name.trim() || !newWorkspace.slug.trim()) return;

    setCreateError("");
    setCreating(true);
    try {
      const { data: createdWorkspace } = await base44.functions.invoke(
        "createWorkspace",
        {
          name: newWorkspace.name.trim(),
          slug: newWorkspace.slug.trim(),
          description: newWorkspace.description.trim(),
          visibility: "restricted",
        },
        { authMode: "user" }
      );

      setShowCreateModal(false);
      resetCreateState();

      if (createdWorkspace?.slug) {
        setWorkspaceSession({ workspace: createdWorkspace, role: "owner" });
        navigate(workspaceDefaultUrl(createdWorkspace.slug, "owner", false));
        return;
      }
      void loadData();
    } catch (error) {
      const status = getErrorStatus(error);
      if (status === 401) {
        await base44.auth.redirectToLogin(window.location.origin + createPageUrl("Workspaces"));
        return;
      }
      console.error("Failed to create workspace:", error);
      setCreateError("Failed to create workspace. Please review the values and try again.");
    } finally {
      setCreating(false);
    }
  };

  const canCreateWorkspace =
    Boolean(newWorkspace.name.trim() && newWorkspace.slug.trim()) &&
    slugStatus.available === true &&
    !slugStatus.checking &&
    !creating;

  if (loading) {
    return (
      <PageLoadingState
        fullHeight
        text="Loading your workspaces..."
        className="bg-slate-50"
      />
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <img src="/base25-logo.png" alt="base25" className="h-8 w-8 object-contain" />
              <span className="text-lg font-semibold text-slate-900">base25</span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAccountSettings(true)}
                className="text-slate-600"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-12">
          <PageShell className="space-y-8">
            {loadError ? (
              <StatePanel
                tone="danger"
                title="Unable to load workspaces"
                description={loadError}
                action={() => {
                  setLoading(true);
                  void loadData();
                }}
                actionLabel="Retry"
              />
            ) : (
              <>
                <PageHeader
                  title="Your Workspaces"
                  description={
                    workspaces.length > 0
                      ? `You have access to ${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"}.`
                      : "Join an existing workspace or create your first workspace to get started."
                  }
                  actions={
                    <>
                      <Button
                        onClick={() => {
                          resetCreateState();
                          setShowCreateModal(true);
                        }}
                        size="lg"
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Workspace
                      </Button>
                      <Button
                        onClick={() => {
                          resetJoinState();
                          setShowJoinModal(true);
                        }}
                        size="lg"
                        className="bg-slate-900 hover:bg-slate-800"
                      >
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Join Workspace
                      </Button>
                    </>
                  }
                />

                {workspaces.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {workspaces.map((workspace) => (
                      <WorkspaceCard
                        key={workspace.id}
                        workspace={workspace}
                        role={workspace.role || "contributor"}
                        onClick={() => openWorkspace(workspace, workspace.role || "contributor")}
                      />
                    ))}
                  </div>
                ) : (
                  <PageEmptyState
                    title="No workspaces yet"
                    description="Use one of the actions above to join a workspace invite or create a new workspace for your team."
                  />
                )}
              </>
            )}

            <Dialog
              open={showJoinModal}
              onOpenChange={(open) => {
                setShowJoinModal(open);
                if (!open) {
                  resetJoinState();
                }
              }}
            >
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Join Workspace</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {joinStep === "link" ? (
                    <div>
                      <Label>Workspace URL</Label>
                      <Input
                        value={joinLink}
                        onChange={(event) => {
                          setJoinLink(event.target.value);
                          setJoinError("");
                        }}
                        placeholder="Paste workspace URL or slug"
                        className="mt-1.5"
                        disabled={joining}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void handleResolveJoinLink();
                          }
                        }}
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Example: https://your-domain.com/workspace/acme/feedback
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label>Workspace</Label>
                        <Input value={joinSlug} readOnly className="mt-1.5 bg-slate-50" />
                      </div>
                      <div>
                        <Label>Join Code</Label>
                        <Input
                          value={joinAccessCode}
                          onChange={(event) => {
                            setJoinAccessCode(event.target.value.toUpperCase());
                            setJoinError("");
                          }}
                          placeholder="Enter access code"
                          className="mt-1.5 font-mono tracking-[0.2em]"
                          disabled={joining}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              void handleJoinWithCode();
                            }
                          }}
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          This workspace is restricted. Enter a valid join code to continue.
                        </p>
                      </div>
                    </div>
                  )}

                  {joinError ? <p className="text-xs text-rose-600">{joinError}</p> : null}

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div>
                      {joinStep === "code" ? (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setJoinStep("link");
                            setJoinAccessCode("");
                            setJoinError("");
                          }}
                          disabled={joining}
                        >
                          Back
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" onClick={() => setShowJoinModal(false)} disabled={joining}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (joinStep === "link") {
                            void handleResolveJoinLink();
                          } else {
                            void handleJoinWithCode();
                          }
                        }}
                        disabled={
                          joining ||
                          (joinStep === "link" && !joinLink.trim()) ||
                          (joinStep === "code" && !joinAccessCode.trim())
                        }
                        className="bg-slate-900 hover:bg-slate-800"
                      >
                        {joining ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Working...
                          </>
                        ) : joinStep === "link" ? (
                          "Continue"
                        ) : (
                          "Join Workspace"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={showAccountSettings}
              onOpenChange={setShowAccountSettings}
            >
              <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Account Settings</DialogTitle>
                </DialogHeader>
                <AccountSettingsPanel />
              </DialogContent>
            </Dialog>

            <Dialog
              open={showCreateModal}
              onOpenChange={(open) => {
                setShowCreateModal(open);
                if (!open) {
                  resetCreateState();
                }
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
                      onChange={(event) =>
                        setNewWorkspace((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="e.g., Product Team"
                      className="mt-1.5"
                      disabled={creating}
                    />
                  </div>
                  <div>
                    <Label>Slug (URL-friendly)</Label>
                    <Input
                      value={newWorkspace.slug}
                      onChange={(event) => {
                        const nextSlug = event.target.value.toLowerCase().replace(/\s+/g, "-");
                        setNewWorkspace((prev) => ({ ...prev, slug: nextSlug }));
                        setSlugStatus(EMPTY_SLUG_STATUS);
                      }}
                      placeholder="e.g., product-feedback"
                      className="mt-1.5"
                      disabled={creating}
                    />
                    {slugStatus.message ? (
                      <p
                        className={`mt-2 flex items-center gap-1 text-xs ${
                          slugStatus.available === false ? "text-rose-600" : "text-slate-500"
                        }`}
                      >
                        {slugStatus.checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {slugStatus.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label>Description (Optional)</Label>
                    <Textarea
                      value={newWorkspace.description}
                      onChange={(event) =>
                        setNewWorkspace((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="Brief description of this workspace"
                      className="mt-1.5"
                      disabled={creating}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowCreateModal(false);
                      }}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateWorkspace}
                      disabled={!canCreateWorkspace}
                      className="bg-slate-900 hover:bg-slate-800"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Workspace"
                      )}
                    </Button>
                  </div>
                  {createError ? <p className="text-xs text-rose-600">{createError}</p> : null}
                </div>
              </DialogContent>
            </Dialog>
          </PageShell>
        </main>
      </div>
    </ProtectedRoute>
  );
}
