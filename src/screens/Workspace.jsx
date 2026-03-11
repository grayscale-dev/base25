"use client";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@/lib/router";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageLoadingState from "@/components/common/PageLoadingState";
import { StatePanel } from "@/components/common/StateDisplay";
import { setWorkspaceSession } from "@/lib/workspace-session";
import { workspaceUrl } from "@/components/utils/workspaceUrl";
import {
  getDefaultWorkspaceSection,
  resolveWorkspaceSection,
} from "@/lib/workspace-sections";
import { startWorkspaceLogin } from "@/lib/start-workspace-login";
import { openStripeBilling } from "@/lib/openStripeBilling";
import { isAdminRole, isOwnerRole } from "@/lib/roles";
import { CreditCard, Loader2 } from "lucide-react";
import Items from "./Items";
import WorkspaceItemView from "./items/WorkspaceItemView";

function toSingleRouteParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default function Workspace({ section = "items", itemId = null }) {
  const navigate = useNavigate();
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
  const [billingGate, setBillingGate] = useState(null);
  const [openingBilling, setOpeningBilling] = useState(false);
  const [syncingBillingStatus, setSyncingBillingStatus] = useState(false);
  const [billingError, setBillingError] = useState("");

  useEffect(() => {
    void initializeWorkspace(routeSlug, routeSection, itemId);
  }, [routeSlug, routeSection, itemId]);

  const initializeWorkspace = async (routeSlugParam, sectionParam, itemIdParam) => {
    try {
      setLoading(true);
      setError(null);
      setAccessRequired(false);
      setActiveSection(null);
      setBillingGate(null);
      setBillingError("");

      if (!routeSlugParam) {
        setError("Invalid workspace URL");
        setLoading(false);
        return;
      }

      const workspaceSlug = routeSlugParam;
      setSlug(workspaceSlug);

      let resolvedWorkspace = null;
      try {
        const { data } = await base44.functions.invoke('publicGetWorkspace', {
          slug: workspaceSlug,
        });
        resolvedWorkspace = data;
      } catch (publicError) {
        const status = publicError?.status || publicError?.response?.status;
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
          try {
            await base44.auth.me();
          } catch {
            const returnUrl = window.location.pathname;
            base44.auth.redirectToLogin(window.location.origin + returnUrl);
            return;
          }
          setAccessRequired(true);
          setLoading(false);
          return;
        }
        throw publicError;
      }

      if (!resolvedWorkspace) {
        setError("Workspace not found");
        setLoading(false);
        return;
      }

      let role = "contributor";
      let isPublicAccess = false;

      try {
        const user = await base44.auth.me();
        const roles = await base44.entities.WorkspaceRole.filter({
          workspace_id: resolvedWorkspace.id,
          user_id: user.id,
        });

        if (roles.length > 0) {
          role = roles[0].role;
          isPublicAccess = false;
        } else if (resolvedWorkspace.visibility === "restricted") {
          setAccessRequired(true);
          setLoading(false);
          return;
        } else {
          role = "contributor";
          isPublicAccess = true;
        }
      } catch {
        if (resolvedWorkspace.visibility !== "public") {
          setError("This workspace is private. Please log in to access it.");
          setLoading(false);
          return;
        }
        isPublicAccess = true;
      }

      const billingBlocked = resolvedWorkspace.billing_access_allowed === false;
      setWorkspaceSession({ workspace: resolvedWorkspace, role, isPublicAccess, billingBlocked });
      setWorkspace(resolvedWorkspace);
      setRole(role);
      setIsPublicAccess(isPublicAccess);

      if (billingBlocked) {
        setBillingGate({
          status: resolvedWorkspace.billing_status || "inactive",
        });
        setLoading(false);
        return;
      }

      if (sectionParam === "item") {
        if (!itemIdParam) {
          setError("Invalid item URL.");
          setLoading(false);
          return;
        }

        setActiveSection("item");
        setLoading(false);
        return;
      }

      const targetSection = resolveWorkspaceSection(sectionParam, role, isPublicAccess);
      if (!targetSection) {
        setError("Invalid workspace section.");
        setLoading(false);
        return;
      }

      if (targetSection !== sectionParam) {
        navigate(workspaceUrl(workspaceSlug, targetSection), { replace: true });
        return;
      }

      setActiveSection(targetSection);
      setLoading(false);
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
    const workspaceSlug = String(routeSlug || workspace?.slug || "").trim();
    if (!workspaceSlug) return false;
    if (!silent) {
      setBillingError("");
      setSyncingBillingStatus(true);
    }
    try {
      const { data } = await base44.functions.invoke(
        "publicGetWorkspace",
        { slug: workspaceSlug },
        { authMode: "user" }
      );

      if (clearFlag) {
        clearBillingQueryFlag();
      }

      const accessAllowed = Boolean(data?.billing_access_allowed);
      if (accessAllowed) {
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
      console.error("Failed to verify workspace billing status:", syncError);
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
        setBillingError("Billing is still processing. Click \"I've Started Billing\" in a few seconds.");
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

  const handleAccessCodeSubmit = async () => {
    if (!accessCode.trim() || !slug) return;
    setAccessSubmitting(true);
    setError(null);
    try {
      const { data } = await base44.functions.invoke('joinWorkspaceWithAccessCode', {
        slug,
        access_code: accessCode.trim(),
      });

      if (data?.workspace) {
        const nextRole = data.role || "contributor";
        const targetSection = getDefaultWorkspaceSection(nextRole, false);
        setWorkspaceSession({
          workspace: data.workspace,
          role: nextRole,
          isPublicAccess: false,
          billingBlocked: false,
        });
        navigate(workspaceUrl(data.workspace.slug, targetSection), { replace: true });
      }
    } catch (joinError) {
      console.error("Failed to join with access code:", joinError);
      setError("Invalid access code. Please try again.");
    } finally {
      setAccessSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoadingState fullHeight text="Loading workspace..." className="bg-slate-50" />;
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
    const isPrivateWorkspaceError = error.toLowerCase().includes("private");
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
          actionLabel={isPrivateWorkspaceError ? "Login" : "Go Home"}
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
                disabled={openingBilling || syncingBillingStatus}
                className="bg-slate-900 hover:bg-slate-800"
              >
                {openingBilling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                {openingBilling ? "Opening Stripe..." : "Start Billing"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void syncBillingStatus();
                }}
                disabled={openingBilling || syncingBillingStatus}
              >
                {syncingBillingStatus ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "I've Started Billing"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/workspaces")}
                disabled={openingBilling || syncingBillingStatus}
              >
                Back to Workspaces
              </Button>
            </div>
          ) : (
            <div className="mt-6">
              <Button variant="outline" onClick={() => navigate("/workspaces")}>
                Back to Workspaces
              </Button>
            </div>
          )}

          {billingError ? <p className="mt-4 text-sm text-rose-600">{billingError}</p> : null}
        </div>
      </div>
    );
  }

  if (!workspace || !activeSection) {
    return <PageLoadingState fullHeight text="Loading workspace..." className="bg-slate-50" />;
  }

  if (activeSection === "item") {
    return (
      <WorkspaceItemView
        workspace={workspace}
        role={role}
        isPublicAccess={isPublicAccess}
        itemId={itemId}
      />
    );
  }

  return (
    <Items
      workspace={workspace}
      role={role}
      isPublicAccess={isPublicAccess}
      section={activeSection}
    />
  );
}
