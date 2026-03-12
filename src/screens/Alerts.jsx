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
import WorkspaceItemCard from "@/components/workspace/WorkspaceItemCard";
import { isAdminRole } from "@/lib/roles";
import {
  fetchWorkspaceAlertsCached,
  fetchWorkspaceItemsCached,
  invalidateWorkspaceAlertQueries,
} from "@/lib/workspace-queries";

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

function createMemberDirectoryMap(members) {
  const map = new Map();
  (members || []).forEach((member) => {
    if (!member?.user_id) return;
    const firstName = String(member.first_name || "").trim();
    const lastName = String(member.last_name || "").trim();
    const displayName = `${firstName} ${lastName}`.trim() || String(member.full_name || "").trim() || member.email;
    map.set(String(member.user_id), {
      ...member,
      display_name: displayName,
    });
  });
  return map;
}

export default function Alerts() {
  const navigate = useNavigate();
  const session = getWorkspaceSession();
  const [workspace, setWorkspace] = useState(session.workspace || null);
  const [role, setRole] = useState(session.role || "contributor");
  const [isPublicAccess, setIsPublicAccess] = useState(Boolean(session.isPublicAccess));
  const [alerts, setAlerts] = useState([]);
  const [watchedItems, setWatchedItems] = useState([]);
  const [activeView, setActiveView] = useState("alerts");
  const [loading, setLoading] = useState(true);
  const [loadingWatchedItems, setLoadingWatchedItems] = useState(false);
  const [watchedItemsLoaded, setWatchedItemsLoaded] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [watchPendingIds, setWatchPendingIds] = useState(() => new Set());
  const [assigneeDirectoryById, setAssigneeDirectoryById] = useState(() => new Map());

  const loadMemberDirectory = async (workspaceId, nextRole) => {
    if (!workspaceId || !isAdminRole(nextRole)) {
      setAssigneeDirectoryById(new Map());
      return;
    }
    try {
      const { data } = await base44.functions.invoke(
        "listWorkspaceMemberDirectory",
        { workspace_id: workspaceId },
        { authMode: "user" }
      );
      setAssigneeDirectoryById(createMemberDirectoryMap(data?.members || []));
    } catch (memberError) {
      console.error("Failed to load member directory for alerts:", memberError);
      setAssigneeDirectoryById(new Map());
    }
  };

  const loadAlerts = async ({ markRead = true, force = false } = {}) => {
    const sessionState = getWorkspaceSession();
    const targetWorkspace = workspace?.id ? workspace : sessionState.workspace;
    const targetRole = sessionState.role || role || "contributor";
    const targetPublicAccess = Boolean(sessionState.isPublicAccess);

    if (!targetWorkspace?.id) {
      navigate(createPageUrl("Workspaces"), { replace: true });
      return;
    }

    setWorkspace(targetWorkspace);
    setRole(targetRole);
    setIsPublicAccess(targetPublicAccess);
    setError("");

    try {
      if (loading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      if (force) {
        await invalidateWorkspaceAlertQueries(targetWorkspace.id);
      }

      const listPromise = fetchWorkspaceAlertsCached({
        workspaceId: targetWorkspace.id,
        limit: 200,
      });
      const markPromise = markRead
        ? base44.functions.invoke(
            "markAlertsRead",
            { workspace_id: targetWorkspace.id },
            { authMode: "user" },
          )
        : Promise.resolve(null);

      const [listResult] = await Promise.all([listPromise, markPromise, loadMemberDirectory(targetWorkspace.id, targetRole)]);
      setAlerts(Array.isArray(listResult) ? listResult : []);

      if (markRead) {
        dispatchAlertsRead(targetWorkspace.id);
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

  const loadWatchedItems = async ({ force = false } = {}) => {
    if (!workspace?.id) return;
    if (!force && watchedItemsLoaded) return;
    setLoadingWatchedItems(true);
    try {
      const data = await fetchWorkspaceItemsCached({
        workspaceId: workspace.id,
        watchedOnly: true,
        limit: 200,
        authMode: "user",
      });
      setWatchedItems(Array.isArray(data) ? data : []);
      setWatchedItemsLoaded(true);
    } catch (loadError) {
      console.error("Failed to load watched items:", loadError);
      setError("Unable to load watched items right now.");
      setWatchedItems([]);
    } finally {
      setLoadingWatchedItems(false);
    }
  };

  useEffect(() => {
    void loadAlerts({ markRead: true });
  }, []);

  useEffect(() => {
    if (activeView !== "watched") return;
    void loadWatchedItems();
  }, [activeView, workspace?.id]);

  const openItem = (itemId) => {
    if (!workspace?.slug || !itemId) return;
    navigate(workspaceItemUrl(workspace.slug, itemId));
  };

  const toggleItemWatch = async (item) => {
    if (!workspace?.id || !item?.id) return;
    if (watchPendingIds.has(item.id)) return;

    const previousAlerts = alerts;
    const previousWatchedItems = watchedItems;
    const nextWatched = !Boolean(item.watched);
    const nextWatcherCount = Math.max(
      0,
      Number(item.watcher_count || 0) + (nextWatched ? 1 : -1),
    );

    const applyWatchState = (entry) =>
      entry?.id === item.id
        ? {
            ...entry,
            watched: nextWatched,
            watcher_count: nextWatcherCount,
          }
        : entry;

    setWatchPendingIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    setAlerts((prev) =>
      prev.map((alert) => ({
        ...alert,
        item: alert.item ? applyWatchState(alert.item) : alert.item,
      }))
    );
    setWatchedItems((prev) => {
      const updated = prev.map((entry) => applyWatchState(entry));
      if (nextWatched) {
        if (updated.some((entry) => entry.id === item.id)) return updated;
        return [{ ...item, watched: true, watcher_count: nextWatcherCount }, ...updated];
      }
      return updated.filter((entry) => entry.id !== item.id);
    });

    try {
      const { data } = await base44.functions.invoke(
        "toggleItemWatch",
        {
          workspace_id: workspace.id,
          item_id: item.id,
        },
        { authMode: "user" }
      );

      const resolvedWatched = Boolean(data?.watched);
      const resolvedWatcherCount = Number(data?.watcher_count || 0);
      const applyResolvedState = (entry) =>
        entry?.id === item.id
          ? {
              ...entry,
              watched: resolvedWatched,
              watcher_count: resolvedWatcherCount,
            }
          : entry;

      setAlerts((prev) =>
        prev.map((alert) => ({
          ...alert,
          item: alert.item ? applyResolvedState(alert.item) : alert.item,
        }))
      );
      setWatchedItems((prev) => {
        const updated = prev.map((entry) => applyResolvedState(entry));
        if (resolvedWatched) {
          if (updated.some((entry) => entry.id === item.id)) return updated;
          return [{ ...item, watched: true, watcher_count: resolvedWatcherCount }, ...updated];
        }
        return updated.filter((entry) => entry.id !== item.id);
      });
    } catch (watchError) {
      console.error("Failed to toggle watch from alerts:", watchError);
      setAlerts(previousAlerts);
      setWatchedItems(previousWatchedItems);
    } finally {
      setWatchPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  if (loading) {
    return <PageLoadingState text="Loading alerts..." />;
  }

  if (error && alerts.length === 0 && activeView === "alerts") {
    return (
      <PageShell>
        <PageHeader title="Alerts" description="Workspace notifications for watched items." />
        <StatePanel
          tone="danger"
          title="Unable to load alerts"
          description={error}
          action={() => {
            void loadAlerts({ markRead: false, force: true });
          }}
          actionLabel="Retry"
        />
      </PageShell>
    );
  }

  const isAlertsView = activeView === "alerts";

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Workspace notifications and watched items."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              if (isAlertsView) {
                void loadAlerts({ markRead: false, force: true });
              } else {
                void loadWatchedItems({ force: true });
              }
            }}
            disabled={refreshing || loadingWatchedItems}
          >
            {refreshing || loadingWatchedItems ? (
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

      <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1">
        <Button
          size="sm"
          variant={isAlertsView ? "default" : "ghost"}
          className={isAlertsView ? "bg-slate-900 hover:bg-slate-800" : ""}
          onClick={() => setActiveView("alerts")}
        >
          Alerts
        </Button>
        <Button
          size="sm"
          variant={!isAlertsView ? "default" : "ghost"}
          className={!isAlertsView ? "bg-slate-900 hover:bg-slate-800" : ""}
          onClick={() => setActiveView("watched")}
        >
          Watched Items
        </Button>
      </div>

      {isAlertsView ? (
        alerts.length === 0 ? (
          <PageEmptyState
            icon={Bell}
            title="No alerts yet"
            description="Watch an item to start receiving alerts for changes and comments."
          />
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) =>
              alert.item ? (
                <WorkspaceItemCard
                  key={alert.id}
                  item={alert.item}
                  role={role}
                  isPublicAccess={isPublicAccess}
                  assigneeDirectoryById={assigneeDirectoryById}
                  timestamp={alert.created_at}
                  timestampLabel="Alerted"
                  contextText={[
                    getAlertTypeLabel(alert.alert_type),
                    String(alert.title || "").trim(),
                    String(alert.body || "").trim(),
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                  watchToggleDisabled={watchPendingIds.has(alert.item.id)}
                  onOpen={() => openItem(alert.item.id)}
                  onToggleWatch={toggleItemWatch}
                />
              ) : (
                <article key={alert.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">{alert.title || "Item update"}</p>
                  {alert.body ? <p className="mt-1 text-sm text-slate-600">{alert.body}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">
                    Alerted <RelativeDate value={alert.created_at} />
                  </p>
                </article>
              )
            )}
          </div>
        )
      ) : loadingWatchedItems && watchedItems.length === 0 ? (
        <PageLoadingState text="Loading watched items..." />
      ) : watchedItems.length === 0 ? (
        <PageEmptyState
          icon={Bell}
          title="No watched items"
          description="Enable alerts on an item to follow updates."
        />
      ) : (
        <div className="space-y-3">
          {watchedItems.map((item) => (
            <WorkspaceItemCard
              key={item.id}
              item={item}
              role={role}
              isPublicAccess={isPublicAccess}
              assigneeDirectoryById={assigneeDirectoryById}
              watchToggleDisabled={watchPendingIds.has(item.id)}
              onOpen={() => openItem(item.id)}
              onToggleWatch={toggleItemWatch}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
