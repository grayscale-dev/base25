"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "@/lib/router";
import { getWorkspaceSession } from "@/lib/workspace-session";
import { createPageUrl } from "@/utils";
import { workspaceItemUrl } from "@/components/utils/workspaceUrl";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/common/PageScaffold";
import PageLoadingState from "@/components/common/PageLoadingState";
import PageEmptyState from "@/components/common/PageEmptyState";
import { StatePanel } from "@/components/common/StateDisplay";
import RelativeDate from "@/components/common/RelativeDate";

function getAlertTypeLabel(alertType) {
  const normalized = String(alertType || "").trim().toLowerCase();
  if (!normalized) return "Update";
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function dispatchAlertsRead(workspaceId) {
  if (typeof window === "undefined") return;
  const detail = workspaceId ? { workspaceId } : undefined;
  window.dispatchEvent(new CustomEvent("workspace-alerts-read", { detail }));
  window.dispatchEvent(new CustomEvent("workspace-alerts-updated", { detail }));
}

export default function Alerts() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadAlerts = async ({ markRead = true } = {}) => {
    const { workspace: storedWorkspace } = getWorkspaceSession();
    if (!storedWorkspace?.id) {
      navigate(createPageUrl("Workspaces"), { replace: true });
      return;
    }

    setWorkspace(storedWorkspace);
    setError("");

    try {
      if (loading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const listPromise = base44.functions.invoke(
        "listAlerts",
        { workspace_id: storedWorkspace.id, limit: 200 },
        { authMode: "user" },
      );
      const markPromise = markRead
        ? base44.functions.invoke(
            "markAlertsRead",
            { workspace_id: storedWorkspace.id },
            { authMode: "user" },
          )
        : Promise.resolve(null);

      const [listResult] = await Promise.all([listPromise, markPromise]);
      setAlerts(listResult?.data?.alerts || []);

      if (markRead) {
        dispatchAlertsRead(storedWorkspace.id);
      }
    } catch (loadError) {
      console.error("Failed to load alerts:", loadError);
      setError("Unable to load alerts right now.");
      setAlerts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAlerts({ markRead: true });
  }, []);

  const openItem = (itemId) => {
    if (!workspace?.slug || !itemId) return;
    navigate(workspaceItemUrl(workspace.slug, itemId));
  };

  if (loading) {
    return <PageLoadingState text="Loading alerts..." />;
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Alerts" description="Workspace notifications for watched items." />
        <StatePanel
          tone="danger"
          title="Unable to load alerts"
          description={error}
          action={() => {
            void loadAlerts({ markRead: false });
          }}
          actionLabel="Retry"
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Workspace notifications for watched items."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void loadAlerts({ markRead: false });
            }}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              "Refresh"
            )}
          </Button>
        }
      />

      {alerts.length === 0 ? (
        <PageEmptyState
          icon={Bell}
          title="No alerts yet"
          description="Watch an item to start receiving alerts for changes and comments."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <article key={alert.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{alert.title || "Item update"}</p>
                  {alert.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{alert.body}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">
                      {getAlertTypeLabel(alert.alert_type)}
                    </span>
                    {alert.item?.title ? (
                      <span className="truncate rounded-full bg-slate-100 px-2 py-0.5">
                        {alert.item.title}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-500">
                    <RelativeDate value={alert.created_at} />
                  </span>
                  {alert.item_id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openItem(alert.item_id)}
                    >
                      Open item
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
