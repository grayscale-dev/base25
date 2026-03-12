"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { useNavigate, useParams } from "@/lib/router";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageLoadingState from "@/components/common/PageLoadingState";
import { StatePanel } from "@/components/common/StateDisplay";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { setWorkspaceSession } from "@/lib/workspace-session";
import { workspaceUrl } from "@/components/utils/workspaceUrl";
import {
  getDefaultWorkspaceSection,
  resolveWorkspaceSection,
} from "@/lib/workspace-sections";
import { startWorkspaceLogin } from "@/lib/start-workspace-login";
import { openStripeBilling } from "@/lib/openStripeBilling";
import { isAdminRole, isOwnerRole } from "@/lib/roles";
import {
  fetchWorkspaceBootstrapCached,
  invalidateWorkspaceBootstrapQueries,
} from "@/lib/workspace-queries";
import { markPerformance, measurePerformance } from "@/lib/performance-marks";
import { WORKSPACE_LOADING_COPY } from "@/lib/workspace-loading";
import { CreditCard, Loader2 } from "lucide-react";
import Items from "./Items";
import WorkspaceItemView from "./items/WorkspaceItemView";

function toSingleRouteParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeBootstrapWorkspace(data) {
  if (!data?.id) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description || "",
    logo_url: data.logo_url || "",
    primary_color: data.primary_color || "#0f172a",
    visibility: data.visibility || "restricted",
    billing_status: data.billing_status || "inactive",
    billing_access_allowed: data.billing_access_allowed !== false,
  };
}

function getErrorStatus(error) {
  if (!error) return null;
  return error.status ?? error.context?.status ?? error.response?.status ?? null;
}

function getErrorMessage(error, fallback = "") {
  const message =
    error?.context?.body?.error ||
    error?.body?.error ||
    error?.message ||
    "";
  const normalized = String(message || "").trim();
  return normalized || fallback;
}

export default function Workspace({ section = "items", itemId = null }) {
  const navigate = useNavigate();
  const nextRouter = useNextRouter();
  const params = useParams();
  const routeSlug = toSingleRouteParam(params?.slug);
  const routeSection = String(section || "items").toLowerCase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [slug, setSlug] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [role, setRole] = useState("contributor");
  const [isPublicAccess, setIsPublicAccess] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [bootstrapData, setBootstrapData] = useState(null);
  const [billingGate, setBillingGate] = useState(null);
  const [openingBilling, setOpeningBilling] = useState(false);
  const [syncingBillingStatus, setSyncingBillingStatus] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [showDeleteWorkspaceDialog, setShowDeleteWorkspaceDialog] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);

  const sectionPrefetchTargets = useMemo(
    () => (isAdminRole(role) && !isPublicAccess
      ? ["feedback", "roadmap", "changelog", "all"]
      : ["feedback", "roadmap", "changelog"]),
    [role, isPublicAccess]
  );

  useEffect(() => {
    void initializeWorkspace(routeSlug, routeSection, itemId);
  }, [routeSlug, routeSection, itemId]);

  useEffect(() => {
    if (!workspace?.slug || billingGate) return;
    sectionPrefetchTargets.forEach((target) => {
      const resolvedTarget = resolveWorkspaceSection(target, role, isPublicAccess);
      if (!resolvedTarget) return;
      nextRouter.prefetch(workspaceUrl(workspace.slug, resolvedTarget));
    });
  }, [workspace?.slug, billingGate, role, isPublicAccess, nextRouter, sectionPrefetchTargets]);

  useEffect(() => {
    if (!workspace?.id || loading || billingGate || !activeSection) return;
    const endMark = `workspace-section-content-end:${workspace.id}:${activeSection}`;
    const startMark = `workspace-bootstrap-start:${workspace.id}:${activeSection}`;
    markPerformance(endMark);
    measurePerformance(`workspace-section-first-content:${workspace.id}:${activeSection}`, startMark, endMark);
  }, [workspace?.id, activeSection, loading, billingGate]);

  const initializeWorkspace = async (routeSlugParam, sectionParam, itemIdParam) => {
    try {
      setError(null);
      setAccessRequired(false);
      setBillingError("");
      setLoading(true);
      setActiveSection(null);
      setBootstrapData(null);
      setBillingGate(null);

      if (!routeSlugParam) {
        setLoading(false);
        setError("Invalid workspace URL");
        return;
      }

      const workspaceSlug = String(routeSlugParam).trim().toLowerCase();
      setSlug(workspaceSlug);

      const includeItems = sectionParam !== "item";
      const sectionStartMark = workspace?.id
        ? `workspace-bootstrap-start:${workspace.id}:${sectionParam}`
        : `workspace-bootstrap-start:${workspaceSlug}:${sectionParam}`;
      markPerformance(sectionStartMark);

      let bootstrapPayload = null;
      try {
        bootstrapPayload = await fetchWorkspaceBootstrapCached({
          slug: workspaceSlug,
          section: sectionParam,
          includeItems,
          limit: sectionParam === "all" ? 200 : 120,
        });
      } catch (bootstrapError) {
        const status = getErrorStatus(bootstrapError);
        if (status === 401) {
          try {
            await base44.auth.logout();
          } catch {
            // Ignore logout failures.
          }
          const returnUrl = window.location.pathname;
          base44.auth.redirectToLogin(window.location.origin + returnUrl);
          return;
        }
        if (status === 403) {
          setAccessRequired(true);
          setLoading(false);
          return;
        }
        throw bootstrapError;
      }

      const resolvedWorkspace = normalizeBootstrapWorkspace(bootstrapPayload);
      if (!resolvedWorkspace) {
        setLoading(false);
        setError("Workspace not found");
        return;
      }

      const resolvedRole = String(bootstrapPayload?.role || "contributor");
      const resolvedPublicAccess = Boolean(bootstrapPayload?.is_public_access);
      const billingBlocked = bootstrapPayload?.billing_access_allowed === false;

      setWorkspaceSession({
        workspace: resolvedWorkspace,
        role: resolvedRole,
        isPublicAccess: resolvedPublicAccess,
        billingBlocked,
      });
      setWorkspace(resolvedWorkspace);
      setRole(resolvedRole);
      setIsPublicAccess(resolvedPublicAccess);
      setBootstrapData({
        groups: Array.isArray(bootstrapPayload?.groups) ? bootstrapPayload.groups : [],
        statuses: Array.isArray(bootstrapPayload?.statuses) ? bootstrapPayload.statuses : [],
        itemTypes: Array.isArray(bootstrapPayload?.item_types) ? bootstrapPayload.item_types : [],
        items: Array.isArray(bootstrapPayload?.items) ? bootstrapPayload.items : [],
        section: sectionParam,
      });

      if (billingBlocked) {
        setBillingGate({
          status: String(bootstrapPayload?.billing_status || "inactive"),
        });
        setLoading(false);
        return;
      }

      if (sectionParam === "item") {
        if (!itemIdParam) {
          setLoading(false);
          setError("Invalid item URL.");
          return;
        }
        setActiveSection("item");
        setLoading(false);
        const sectionEndMark = `workspace-bootstrap-end:${resolvedWorkspace.id}:${sectionParam}`;
        markPerformance(sectionEndMark);
        measurePerformance(`workspace-bootstrap:${resolvedWorkspace.id}:${sectionParam}`, sectionStartMark, sectionEndMark);
        return;
      }

      const targetSection = resolveWorkspaceSection(sectionParam, resolvedRole, resolvedPublicAccess);
      if (!targetSection) {
        setLoading(false);
        setError("Invalid workspace section.");
        return;
      }

      if (targetSection !== sectionParam) {
        navigate(workspaceUrl(workspaceSlug, targetSection), { replace: true });
        return;
      }

      setActiveSection(targetSection);
      setLoading(false);
      const sectionEndMark = `workspace-bootstrap-end:${resolvedWorkspace.id}:${sectionParam}`;
      markPerformance(sectionEndMark);
      measurePerformance(`workspace-bootstrap:${resolvedWorkspace.id}:${sectionParam}`, sectionStartMark, sectionEndMark);
    } catch (initializationError) {
      console.error("Workspace initialization error:", initializationError);
      setError("Unable to open workspace");
      setLoading(false);
    }
  };

  const clearBillingQueryFlag = () => {
    if (typeof window === "undefined") return;
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete("billing");
    window.history.replaceState({}, "", currentUrl.toString());
  };

  const syncBillingStatus = async ({ silent = false, clearFlag = false } = {}) => {
    if (!workspace?.id) return false;
    if (!silent) {
      setBillingError("");
      setSyncingBillingStatus(true);
    }
    try {
      let data = null;
      try {
        const refreshResult = await base44.functions.invoke(
          "refreshWorkspaceBillingStatus",
          { workspace_id: workspace.id },
          { authMode: "user" }
        );
        data = refreshResult?.data || null;
      } catch (refreshError) {
        const status = getErrorStatus(refreshError);
        if (status !== 404) {
          throw refreshError;
        }
        const fallback = await base44.functions.invoke(
          "publicGetWorkspace",
          { slug: workspace.slug },
          { authMode: "user" }
        );
        data = {
          billing_status: fallback?.data?.billing_status || "inactive",
          billing_access_allowed: Boolean(fallback?.data?.billing_access_allowed),
        };
      }

      if (clearFlag) {
        clearBillingQueryFlag();
      }

      const accessAllowed = Boolean(data?.billing_access_allowed);
      if (accessAllowed) {
        await invalidateWorkspaceBootstrapQueries(workspace.slug);
        await initializeWorkspace(routeSlug, routeSection, itemId);
        return true;
      }

      setBillingGate({
        status: String(data?.billing_status || billingGate?.status || "inactive"),
      });
      if (!silent) {
        setBillingError("Billing is still inactive for this workspace.");
      }
      return false;
    } catch (syncError) {
      console.error("Failed to refresh workspace billing status:", syncError);
      if (clearFlag) {
        clearBillingQueryFlag();
      }
      if (!silent) {
        setBillingError("Unable to verify billing status right now. Please try again.");
      }
      return false;
    } finally {
      if (!silent) {
        setSyncingBillingStatus(false);
      }
    }
  };

  useEffect(() => {
    if (!billingGate || !workspace?.id) return;
    if (typeof window === "undefined") return;

    const billingParam = new URLSearchParams(window.location.search).get("billing");
    if (billingParam !== "success") return;

    clearBillingQueryFlag();

    let cancelled = false;
    let attempts = 0;

    const pollBillingStatus = async () => {
      attempts += 1;
      const unlocked = await syncBillingStatus({ silent: true, clearFlag: false });
      if (cancelled || unlocked) return;
      if (attempts >= 6) {
        setBillingError("Billing is still processing. Try again in a few seconds.");
        return;
      }
      window.setTimeout(() => {
        void pollBillingStatus();
      }, 3000);
    };

    void pollBillingStatus();
    return () => {
      cancelled = true;
    };
  }, [billingGate?.status, workspace?.id, routeSlug, routeSection, itemId]);

  const handleOpenBilling = async () => {
    if (!workspace?.id || !isAdminRole(role)) return;
    setBillingError("");

    if (!isOwnerRole(role)) {
      setBillingError("Only workspace owners can start billing for this workspace.");
      return;
    }

    setOpeningBilling(true);
    try {
      const result = await openStripeBilling({
        workspaceId: workspace.id,
        returnUrl: window.location.href,
        mode: "subscribe",
      });
      if (!result.ok) {
        setBillingError(result.error || "Unable to open Stripe billing.");
      }
    } catch (billingOpenError) {
      console.error("Failed to open Stripe billing from workspace gate:", billingOpenError);
      setBillingError("Unable to open Stripe billing right now.");
    } finally {
      setOpeningBilling(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace?.id) return;
    setDeletingWorkspace(true);
    setBillingError("");
    try {
      await base44.functions.invoke(
        "archiveWorkspace",
        { workspace_id: workspace.id },
        { authMode: "user" }
      );
      sessionStorage.clear();
      navigate(createPageUrl("Workspaces"));
    } catch (deleteError) {
      console.error("Failed to archive workspace from billing gate:", deleteError);
      const status = getErrorStatus(deleteError);
      if (status === 403) {
        setBillingError("Only the workspace owner can delete this workspace.");
      } else if (status === 409) {
        setBillingError(
          getErrorMessage(
            deleteError,
            "Active billing must be canceled before deleting this workspace."
          )
        );
      } else {
        setBillingError(getErrorMessage(deleteError, "Failed to delete workspace."));
      }
    } finally {
      setDeletingWorkspace(false);
      setShowDeleteWorkspaceDialog(false);
    }
  };

  const handleAccessCodeSubmit = async () => {
    if (!accessCode.trim() || !slug) return;
    setAccessSubmitting(true);
    setError(null);
    try {
      const { data } = await base44.functions.invoke("joinWorkspaceWithAccessCode", {
        slug,
        access_code: accessCode.trim(),
      });

      if (data?.workspace) {
        const nextRole = data.role || "contributor";
        const targetSection = getDefaultWorkspaceSection(nextRole, false);
        const targetUrl = workspaceUrl(data.workspace.slug, targetSection);
        setWorkspaceSession({
          workspace: data.workspace,
          role: nextRole,
          isPublicAccess: false,
          billingBlocked: false,
        });
        if (typeof window !== "undefined" && window.location.pathname === targetUrl) {
          window.location.replace(targetUrl);
          return;
        }
        navigate(targetUrl, { replace: true });
      }
    } catch (joinError) {
      console.error("Failed to join with access code:", joinError);
      setError("Invalid access code. Please try again.");
    } finally {
      setAccessSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoadingState fullHeight text={WORKSPACE_LOADING_COPY} className="bg-slate-50" />;
  }

  if (accessRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Enter access code</h2>
            <p className="mt-2 text-slate-600">
              This workspace is private. Enter the access code provided by an admin.
            </p>
          </div>
          <div className="space-y-3">
            <Input
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Access code"
              className="text-center uppercase tracking-[0.3em]"
              disabled={accessSubmitting}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAccessCodeSubmit();
              }}
            />
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </div>
          <Button
            onClick={handleAccessCodeSubmit}
            disabled={accessSubmitting || !accessCode.trim()}
            className="w-full bg-slate-900 hover:bg-slate-800"
          >
            {accessSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              "Join Workspace"
            )}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/")} disabled={accessSubmitting}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    const isPrivateWorkspaceError = String(error || "").toLowerCase().includes("private");
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <StatePanel
          tone="danger"
          title="Unable to open workspace"
          description={error}
          action={
            isPrivateWorkspaceError
              ? () => startWorkspaceLogin({ redirectTo: window.location.href })
              : () => navigate("/")
          }
          actionLabel={isPrivateWorkspaceError ? "Get Started" : "Go Home"}
          secondaryAction={isPrivateWorkspaceError ? () => navigate("/") : undefined}
          secondaryActionLabel={isPrivateWorkspaceError ? "Go Home" : undefined}
        />
      </div>
    );
  }

  if (billingGate && workspace) {
    const adminLike = isAdminRole(role);
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">
            {adminLike ? "Billing setup required" : "Workspace temporarily unavailable"}
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            {adminLike
              ? "This workspace is blocked until an active or trialing subscription is started."
              : "This workspace is currently down. Please come back later."}
          </p>
          <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
            Billing status: {String(billingGate.status || "inactive")}
          </p>

          {adminLike ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => {
                  void handleOpenBilling();
                }}
                disabled={openingBilling || syncingBillingStatus || deletingWorkspace}
                className="bg-slate-900 hover:bg-slate-800"
              >
                {openingBilling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                {openingBilling ? "Opening Stripe..." : "Go to Billing"}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/workspaces")}
                disabled={openingBilling || syncingBillingStatus || deletingWorkspace}
              >
                Back to Workspaces
              </Button>
              {isOwnerRole(role) ? (
                <Button
                  variant="destructive"
                  className="bg-rose-600 hover:bg-rose-700"
                  onClick={() => setShowDeleteWorkspaceDialog(true)}
                  disabled={openingBilling || syncingBillingStatus || deletingWorkspace}
                >
                  {deletingWorkspace ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Delete Workspace
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="mt-6">
              <Button variant="outline" onClick={() => navigate("/workspaces")}>
                Back to Workspaces
              </Button>
            </div>
          )}

          {billingError ? <p className="mt-4 text-sm text-rose-600">{billingError}</p> : null}
          <ConfirmDialog
            open={showDeleteWorkspaceDialog}
            onOpenChange={setShowDeleteWorkspaceDialog}
            title="Delete Workspace"
            description="This archives the workspace and removes access for everyone. This action cannot be undone."
            confirmLabel={deletingWorkspace ? "Deleting..." : "Delete Workspace"}
            onConfirm={() => {
              void handleDeleteWorkspace();
            }}
            loading={deletingWorkspace}
            confirmClassName="bg-rose-600 hover:bg-rose-700"
          />
        </div>
      </div>
    );
  }

  if (!workspace || !activeSection) {
    return <PageLoadingState fullHeight text={WORKSPACE_LOADING_COPY} className="bg-slate-50" />;
  }

  if (activeSection === "item") {
    return (
      <WorkspaceItemView
        workspace={workspace}
        role={role}
        isPublicAccess={isPublicAccess}
        itemId={itemId}
        bootstrapData={bootstrapData}
      />
    );
  }

  return (
    <Items
      workspace={workspace}
      role={role}
      isPublicAccess={isPublicAccess}
      section={activeSection}
      bootstrapData={bootstrapData}
    />
  );
}
