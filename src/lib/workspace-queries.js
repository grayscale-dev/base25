import { base44 } from "@/api/base44Client";
import { queryClientInstance } from "@/lib/query-client";
import { WORKSPACE_CACHE_STALE_TIME_MS } from "@/lib/workspace-loading";

export const workspaceQueryKeys = {
  bootstrap: ({ slug, section, statusId, includeItems = false, limit = 80 }) => [
    "workspaceBootstrap",
    String(slug || "").toLowerCase(),
    String(section || ""),
    String(statusId || "all"),
    includeItems ? "items" : "config",
    Number(limit || 80),
  ],
  listMyWorkspaces: ["listMyWorkspaces"],
  listItems: ({ workspaceId, groupKey, statusId = "all", watchedOnly = false, limit = 50 }) => [
    "listItems",
    String(workspaceId || ""),
    String(groupKey || "all"),
    String(statusId || "all"),
    watchedOnly ? "watched" : "all-items",
    Number(limit || 50),
  ],
  alerts: ({ workspaceId, limit = 200 }) => [
    "alerts",
    String(workspaceId || ""),
    Number(limit || 200),
  ],
  unreadAlerts: ({ workspaceId }) => ["unreadAlerts", String(workspaceId || "")],
  search: ({ workspaceId, query, limit = 100 }) => [
    "workspaceSearch",
    String(workspaceId || ""),
    String(query || "").trim(),
    Number(limit || 100),
  ],
};

function getErrorStatus(error) {
  if (!error) return null;
  return error.status ?? error.context?.status ?? error.response?.status ?? null;
}

function isGroupSection(section) {
  return section === "feedback" || section === "roadmap" || section === "changelog";
}

export async function fetchWorkspaceBootstrap({
  slug,
  section = "",
  statusId = "all",
  includeItems = false,
  limit = 80,
} = {}) {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  const normalizedSection = String(section || "").trim().toLowerCase();
  const normalizedStatusId = statusId && statusId !== "all" ? String(statusId) : "";
  const normalizedLimit = Number(limit || 80);

  try {
    const { data } = await base44.functions.invoke(
      "workspaceBootstrap",
      {
        slug: normalizedSlug,
        section: normalizedSection,
        status_id: normalizedStatusId,
        include_items: Boolean(includeItems),
        limit: normalizedLimit,
      },
      { authMode: "user" }
    );
    return data || null;
  } catch (error) {
    const status = getErrorStatus(error);
    if (status !== 404) {
      throw error;
    }

    // Fallback for environments where the consolidated function is not deployed yet.
    const { data: workspace } = await base44.functions.invoke(
      "publicGetWorkspace",
      { slug: normalizedSlug },
      { authMode: "user" }
    );
    if (!workspace?.id) return null;

    const [statusConfigResult, itemTypesResult] = await Promise.all([
      base44.functions.invoke(
        "getItemStatusConfig",
        { workspace_id: workspace.id },
        { authMode: "user" }
      ),
      base44.functions.invoke(
        "listItemTypes",
        { workspace_id: workspace.id, active_only: true },
        { authMode: "user" }
      ),
    ]);

    let fallbackItems = [];
    if (includeItems) {
      const payload = { workspace_id: workspace.id };
      if (isGroupSection(normalizedSection)) {
        payload.group_key = normalizedSection;
      }
      if (normalizedStatusId) {
        payload.status_id = normalizedStatusId;
      }
      const itemsResult = await base44.functions.invoke(
        "listItems",
        payload,
        { authMode: "user" }
      );
      fallbackItems = Array.isArray(itemsResult?.data?.items)
        ? itemsResult.data.items.slice(0, normalizedLimit)
        : [];
    }

    return {
      ...workspace,
      role: workspace.role || "contributor",
      is_public_access: false,
      groups: Array.isArray(statusConfigResult?.data?.groups) ? statusConfigResult.data.groups : [],
      statuses: Array.isArray(statusConfigResult?.data?.statuses) ? statusConfigResult.data.statuses : [],
      item_types: Array.isArray(itemTypesResult?.data?.item_types) ? itemTypesResult.data.item_types : [],
      items: fallbackItems,
    };
  }
}

export function getWorkspaceBootstrapQueryOptions({
  slug,
  section,
  statusId,
  includeItems = false,
  limit = 80,
} = {}) {
  return {
    queryKey: workspaceQueryKeys.bootstrap({ slug, section, statusId, includeItems, limit }),
    queryFn: () => fetchWorkspaceBootstrap({ slug, section, statusId, includeItems, limit }),
    staleTime: WORKSPACE_CACHE_STALE_TIME_MS,
  };
}

export function fetchWorkspaceBootstrapCached(params) {
  return queryClientInstance.fetchQuery(getWorkspaceBootstrapQueryOptions(params));
}

export async function fetchListMyWorkspaces() {
  try {
    const { data } = await base44.functions.invoke("listMyWorkspaces", {}, { authMode: "user" });
    return Array.isArray(data?.workspaces) ? data.workspaces : [];
  } catch (error) {
    const status = getErrorStatus(error);
    if (status !== 404) {
      throw error;
    }

    // Fallback for environments where the consolidated function is not deployed yet.
    const currentUser = await base44.auth.me();
    const roles = await base44.entities.WorkspaceRole.filter({
      user_id: currentUser.id,
    });

    if (!Array.isArray(roles) || roles.length === 0) {
      return [];
    }

    const uniqueWorkspaceIds = [...new Set(roles.map((entry) => entry.workspace_id).filter(Boolean))];
    const roleByWorkspaceId = new Map(
      roles.map((entry) => [String(entry.workspace_id), String(entry.role || "contributor")])
    );
    const workspaceRows = await Promise.all(
      uniqueWorkspaceIds.map(async (id) => {
        const rows = await base44.entities.Workspace.filter({ id });
        return rows?.[0] || null;
      })
    );

    return workspaceRows
      .filter((workspace) => workspace && workspace.status === "active")
      .map((workspace) => ({
        ...workspace,
        role: roleByWorkspaceId.get(String(workspace.id)) || "contributor",
      }))
      .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
  }
}

export function fetchListMyWorkspacesCached() {
  return queryClientInstance.fetchQuery({
    queryKey: workspaceQueryKeys.listMyWorkspaces,
    queryFn: fetchListMyWorkspaces,
    staleTime: WORKSPACE_CACHE_STALE_TIME_MS,
  });
}

export async function fetchWorkspaceItems({
  workspaceId,
  groupKey = null,
  statusId = "all",
  watchedOnly = false,
  limit = 50,
  authMode = "user",
}) {
  const payload = { workspace_id: workspaceId };
  if (groupKey) payload.group_key = groupKey;
  if (statusId && statusId !== "all") payload.status_id = statusId;
  if (watchedOnly) payload.watched_only = true;
  payload.limit = Math.min(Math.max(Number(limit || 50), 1), 200);
  const { data } = await base44.functions.invoke("listItems", payload, { authMode });
  return Array.isArray(data?.items) ? data.items : [];
}

export function fetchWorkspaceItemsCached({
  workspaceId,
  groupKey = null,
  statusId = "all",
  watchedOnly = false,
  limit = 50,
  authMode = "user",
}) {
  return queryClientInstance.fetchQuery({
    queryKey: workspaceQueryKeys.listItems({ workspaceId, groupKey, statusId, watchedOnly, limit }),
    queryFn: () => fetchWorkspaceItems({ workspaceId, groupKey, statusId, watchedOnly, limit, authMode }),
    staleTime: WORKSPACE_CACHE_STALE_TIME_MS,
  });
}

export function invalidateWorkspaceItemQueries(workspaceId) {
  return queryClientInstance.invalidateQueries({
    queryKey: ["listItems", String(workspaceId || "")],
  });
}

export function invalidateWorkspaceBootstrapQueries(slug) {
  return queryClientInstance.invalidateQueries({
    queryKey: ["workspaceBootstrap", String(slug || "").toLowerCase()],
  });
}

export async function fetchWorkspaceSearch({ workspaceId, query, limit = 100 }) {
  const { data } = await base44.functions.invoke(
    "searchWorkspaceItems",
    { workspace_id: workspaceId, query, limit },
    { authMode: "user" }
  );
  return Array.isArray(data?.results) ? data.results : [];
}

export function fetchWorkspaceSearchCached({ workspaceId, query, limit = 100 }) {
  return queryClientInstance.fetchQuery({
    queryKey: workspaceQueryKeys.search({ workspaceId, query, limit }),
    queryFn: () => fetchWorkspaceSearch({ workspaceId, query, limit }),
    staleTime: WORKSPACE_CACHE_STALE_TIME_MS,
  });
}

export async function fetchWorkspaceAlerts({ workspaceId, limit = 200 }) {
  const { data } = await base44.functions.invoke(
    "listAlerts",
    { workspace_id: workspaceId, limit },
    { authMode: "user" }
  );
  return Array.isArray(data?.alerts) ? data.alerts : [];
}

export function fetchWorkspaceAlertsCached({ workspaceId, limit = 200 }) {
  return queryClientInstance.fetchQuery({
    queryKey: workspaceQueryKeys.alerts({ workspaceId, limit }),
    queryFn: () => fetchWorkspaceAlerts({ workspaceId, limit }),
    staleTime: WORKSPACE_CACHE_STALE_TIME_MS,
  });
}

export async function fetchUnreadAlertCount({ workspaceId }) {
  const { data } = await base44.functions.invoke(
    "getUnreadAlertCount",
    { workspace_id: workspaceId },
    { authMode: "user" }
  );
  return Number(data?.unread_count || 0);
}

export function fetchUnreadAlertCountCached({ workspaceId }) {
  return queryClientInstance.fetchQuery({
    queryKey: workspaceQueryKeys.unreadAlerts({ workspaceId }),
    queryFn: () => fetchUnreadAlertCount({ workspaceId }),
    staleTime: WORKSPACE_CACHE_STALE_TIME_MS,
  });
}

export function invalidateWorkspaceAlertQueries(workspaceId) {
  return Promise.all([
    queryClientInstance.invalidateQueries({
      queryKey: ["alerts", String(workspaceId || "")],
    }),
    queryClientInstance.invalidateQueries({
      queryKey: ["unreadAlerts", String(workspaceId || "")],
    }),
  ]);
}
