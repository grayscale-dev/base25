import { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { canContributeRole, isAdminRole } from "@/lib/roles";
import {
  getMetadataShapeForGroup,
  ITEM_GROUP_KEYS,
  ITEM_GROUP_LABELS,
  getGroupColor,
  getGroupLabel,
  validateMetadata,
} from "@/lib/item-groups";
import {
  fetchWorkspaceBootstrapCached,
  fetchWorkspaceItemsCached,
  invalidateWorkspaceItemQueries,
} from "@/lib/workspace-queries";
import { WORKSPACE_CACHE_STALE_TIME_MS } from "@/lib/workspace-loading";

const SYSTEM_ACTIVITY_LABELS = {
  update: "Update",
  status_change: "Status change",
  group_change: "Group change",
  system: "System",
};

function resolveTimestamp(value) {
  return value?.created_date || value?.created_at || value?.updated_date || value?.updated_at || null;
}

function sortByCreatedAsc(left, right) {
  const leftTime = new Date(resolveTimestamp(left) || 0).getTime();
  const rightTime = new Date(resolveTimestamp(right) || 0).getTime();
  return leftTime - rightTime;
}

function sortByCreatedDesc(left, right) {
  return sortByCreatedAsc(right, left);
}

function resolveActivityAuthorLabel(activity, currentUserId) {
  if (currentUserId && activity?.author_id === currentUserId) return "You";
  if (activity?.author_role === "admin") return "Admin";
  if (activity?.author_id) return "Member";
  return "Unknown";
}

function resolveInitialPostAuthorLabel(item, currentUserId) {
  if (currentUserId && item?.submitter_id === currentUserId) return "You";
  if (item?.submitter_email) return item.submitter_email;
  if (item?.submitter_id) return "Member";
  return "Unknown";
}

function buildMemberName(member) {
  if (!member) return "";
  const first = String(member.first_name || "").trim();
  const last = String(member.last_name || "").trim();
  const full = String(member.full_name || "").trim();
  if (first || last) return `${first} ${last}`.trim();
  if (full) return full;
  const local = String(member.email || "").split("@")[0] || "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveApiErrorMessage(error, fallback = "") {
  const message =
    error?.context?.body?.error ||
    error?.body?.error ||
    error?.message ||
    "";
  const normalized = String(message || "").trim();
  return normalized || fallback;
}

function normalizeHexColor(value) {
  const normalized = String(value || "").trim();
  const short = normalized.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const full = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (full) {
    return `#${full[1].toUpperCase()}`;
  }
  return null;
}

function resolveSafeGroupColor(groupKey, preferredColor) {
  const normalized = normalizeHexColor(preferredColor);
  if (normalized && normalized !== "#FFFFFF") {
    return normalized;
  }
  return getGroupColor(groupKey);
}

function normalizeReactionRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    ...row,
    emoji: String(row?.emoji || ""),
    count: Number(row?.count || 0),
    reacted: Boolean(row?.reacted),
  }));
}

function computeReactionCount(rows) {
  return normalizeReactionRows(rows).reduce((total, row) => total + Math.max(0, Number(row.count || 0)), 0);
}

function toggleReactionRows(rows, emoji) {
  const normalizedEmoji = String(emoji || "");
  if (!normalizedEmoji) return normalizeReactionRows(rows);

  const normalizedRows = normalizeReactionRows(rows);
  let matched = false;
  const nextRows = [];

  normalizedRows.forEach((row) => {
    if (row.emoji !== normalizedEmoji) {
      nextRows.push(row);
      return;
    }
    matched = true;
    if (row.reacted) {
      const nextCount = Math.max(0, row.count - 1);
      if (nextCount > 0) {
        nextRows.push({ ...row, reacted: false, count: nextCount });
      }
      return;
    }
    nextRows.push({ ...row, reacted: true, count: row.count + 1 });
  });

  if (!matched) {
    nextRows.push({
      emoji: normalizedEmoji,
      count: 1,
      reacted: true,
    });
  }

  return nextRows;
}

function createEmptyItemEngagement() {
  return {
    watched: false,
    watcher_count: 0,
    item_reactions: [],
    item_reaction_count: 0,
    comment_reactions: {},
  };
}

export function useItemsController({ workspace, role, isPublicAccess, bootstrapData = null }) {
  const bootstrapGroups = Array.isArray(bootstrapData?.groups) ? bootstrapData.groups : [];
  const bootstrapStatuses = Array.isArray(bootstrapData?.statuses) ? bootstrapData.statuses : [];
  const bootstrapItemTypes = Array.isArray(bootstrapData?.itemTypes) ? bootstrapData.itemTypes : [];
  const bootstrapItems = Array.isArray(bootstrapData?.items) ? bootstrapData.items : [];
  const hasBootstrapConfig = bootstrapStatuses.length > 0 || bootstrapItemTypes.length > 0;
  const [currentUser, setCurrentUser] = useState(null);
  const [groups, setGroups] = useState(bootstrapGroups);
  const [statuses, setStatuses] = useState(bootstrapStatuses);
  const [itemTypes, setItemTypes] = useState(bootstrapItemTypes);
  const [memberDirectory, setMemberDirectory] = useState([]);
  const [items, setItems] = useState(bootstrapItems);
  const [selectedItem, setSelectedItem] = useState(null);
  const [commentActivities, setCommentActivities] = useState([]);
  const [systemActivities, setSystemActivities] = useState([]);
  const [itemEngagement, setItemEngagement] = useState(createEmptyItemEngagement());
  const [loadingConfig, setLoadingConfig] = useState(!hasBootstrapConfig);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingSystemActivity, setLoadingSystemActivity] = useState(false);
  const [systemActivityLoadedItemId, setSystemActivityLoadedItemId] = useState(null);
  const [savingItem, setSavingItem] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [error, setError] = useState("");

  const currentUserId = currentUser?.id || null;
  const isAdmin = isAdminRole(role) && !isPublicAccess;
  const canComment = !isPublicAccess && canContributeRole(role);
  const hasLocalConfig = statuses.length > 0 || itemTypes.length > 0;
  const bootstrapListKeyRef = useRef(null);
  const bootstrapListConsumedRef = useRef(false);
  const lastConfigLoadRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const loadCurrentUser = async () => {
      try {
        const user = await base44.auth.me();
        if (!cancelled) setCurrentUser(user);
      } catch {
        if (!cancelled) setCurrentUser(null);
      }
    };
    void loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const nextGroups = Array.isArray(bootstrapData?.groups) ? bootstrapData.groups : [];
    const nextStatuses = Array.isArray(bootstrapData?.statuses) ? bootstrapData.statuses : [];
    const nextItemTypes = Array.isArray(bootstrapData?.itemTypes) ? bootstrapData.itemTypes : [];
    const nextItems = Array.isArray(bootstrapData?.items) ? bootstrapData.items : [];
    const bootstrapSection = String(bootstrapData?.section || "").toLowerCase();
    const bootstrapListKey =
      bootstrapSection === "all" || !bootstrapSection
        ? "all:all"
        : `${bootstrapSection}:all`;

    if (nextStatuses.length > 0 || nextItemTypes.length > 0) {
      setGroups(nextGroups);
      setStatuses(nextStatuses);
      setItemTypes(nextItemTypes);
      setLoadingConfig(false);
      lastConfigLoadRef.current = Date.now();
    }

    if (nextItems.length > 0) {
      setItems(nextItems.map((entry) => hydrateItem(entry)));
      bootstrapListKeyRef.current = bootstrapListKey;
      bootstrapListConsumedRef.current = false;
    } else {
      bootstrapListKeyRef.current = null;
      bootstrapListConsumedRef.current = true;
    }
  }, [bootstrapData?.groups, bootstrapData?.statuses, bootstrapData?.itemTypes, bootstrapData?.items, bootstrapData?.section]);

  const statusesByGroup = useMemo(() => {
    const grouped = {};
    ITEM_GROUP_KEYS.forEach((groupKey) => {
      grouped[groupKey] = [];
    });
    statuses.forEach((status) => {
      if (!grouped[status.group_key]) {
        grouped[status.group_key] = [];
      }
      grouped[status.group_key].push(status);
    });
    Object.keys(grouped).forEach((groupKey) => {
      grouped[groupKey].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    });
    return grouped;
  }, [statuses]);

  const statusById = useMemo(() => {
    const map = new Map();
    statuses.forEach((status) => {
      map.set(status.id, status);
    });
    return map;
  }, [statuses]);

  const itemTypesById = useMemo(() => {
    const map = new Map();
    itemTypes.forEach((type) => {
      map.set(type.id, type);
    });
    return map;
  }, [itemTypes]);

  const memberDirectoryById = useMemo(() => {
    const map = new Map();
    memberDirectory.forEach((member) => {
      map.set(member.user_id, {
        ...member,
        display_name: buildMemberName(member),
      });
    });
    return map;
  }, [memberDirectory]);

  const hydrateItem = (item) => {
    if (!item) return item;
    const statusRecord =
      statusById.get(item.status_id) ||
      statuses.find(
        (status) =>
          status?.status_key &&
          item?.status_key &&
          String(status.status_key) === String(item.status_key)
      ) ||
      null;
    const rawGroupKey = statusRecord?.group_key || item.group_key;
    const normalizedGroupKey = typeof rawGroupKey === "string" ? rawGroupKey.toLowerCase() : rawGroupKey;
    const groupKey = ITEM_GROUP_KEYS.includes(normalizedGroupKey) ? normalizedGroupKey : rawGroupKey;
    const groupLabel = ITEM_GROUP_LABELS[groupKey] || getGroupLabel(groupKey);
    const resolvedGroupColor =
      groups.find((group) => group.group_key === groupKey)?.color_hex ||
      item.group_color ||
      getGroupColor(groupKey);
    const groupColor = resolveSafeGroupColor(groupKey, resolvedGroupColor);
    const statusLabel = statusRecord?.label || item.status_label || item.status_key || "Unknown";
    const typeRecord = itemTypesById.get(item.item_type_id) || null;
    const assigneeRecord = item.assigned_to ? memberDirectoryById.get(item.assigned_to) || null : null;

    return {
      ...item,
      group_key: groupKey,
      group_label: groupLabel,
      group_color: groupColor,
      status_label: statusLabel,
      item_type_label: typeRecord?.label || item.item_type_label || "No Type",
      assignee: assigneeRecord
        ? {
            id: assigneeRecord.user_id,
            name: assigneeRecord.display_name,
            profile_photo_url: assigneeRecord.profile_photo_url || null,
          }
        : null,
    };
  };

  const canEditInitialPost = (item) =>
    Boolean(currentUserId && item?.submitter_id && item.submitter_id === currentUserId);

  const canEditComment = (activity) =>
    Boolean(currentUserId && activity?.author_id && activity.author_id === currentUserId);

  const canDeleteComment = () => false;

  const canDeleteItem = (item) => {
    if (!item) return false;
    return isAdmin;
  };

  const thread = useMemo(() => {
    if (!selectedItem?.id) {
      return { initialPost: null, comments: [], systemActivity: [] };
    }

    const initialPost = {
      id: `initial-post-${selectedItem.id}`,
      kind: "initial_post",
      item_id: selectedItem.id,
      content: selectedItem.description || "",
      created_at: resolveTimestamp(selectedItem),
      author_id: selectedItem.submitter_id || null,
      author_label: resolveInitialPostAuthorLabel(selectedItem, currentUserId),
      can_edit: canEditInitialPost(selectedItem),
      is_legacy_unowned: !selectedItem.submitter_id,
    };

    const comments = commentActivities
      .filter((activity) => activity.activity_type === "comment")
      .slice()
      .sort(sortByCreatedAsc)
      .map((activity) => ({
        ...activity,
        created_at_resolved: resolveTimestamp(activity),
        author_label: resolveActivityAuthorLabel(activity, currentUserId),
        can_edit: canEditComment(activity),
        can_delete: canDeleteComment(activity),
        reactions: itemEngagement.comment_reactions?.[activity.id] || [],
      }));

    const systemActivity = systemActivities
      .filter((activity) => activity.activity_type !== "comment")
      .slice()
      .sort(sortByCreatedDesc)
      .map((activity) => ({
        ...activity,
        created_at_resolved: resolveTimestamp(activity),
        activity_type_label:
          SYSTEM_ACTIVITY_LABELS[activity.activity_type] || activity.activity_type || "Activity",
        author_label: resolveActivityAuthorLabel(activity, currentUserId),
      }));

    return { initialPost, comments, systemActivity };
  }, [selectedItem, commentActivities, systemActivities, currentUserId, isAdmin, itemEngagement.comment_reactions]);

  useEffect(() => {
    if (!workspace?.id) {
      setLoadingConfig(false);
      setError("Workspace context is missing.");
      return;
    }
    const shouldBackgroundRefresh = hasLocalConfig;
    if (shouldBackgroundRefresh) {
      setLoadingConfig(false);
    }
    void loadWorkspaceConfig(workspace.id, { background: shouldBackgroundRefresh });
  }, [workspace?.id, workspace?.slug, role, isPublicAccess]);

  useEffect(() => {
    if (!workspace?.id) return;
    setItems((prev) => prev.map((item) => hydrateItem(item)));
    setSelectedItem((prev) => (prev ? hydrateItem(prev) : prev));
  }, [groups, statuses, itemTypes, memberDirectory]);

  const loadWorkspaceConfig = async (workspaceId, { background = false } = {}) => {
    try {
      const now = Date.now();
      if (
        background &&
        lastConfigLoadRef.current > 0 &&
        now - lastConfigLoadRef.current < WORKSPACE_CACHE_STALE_TIME_MS
      ) {
        return;
      }

      if (!background) {
        setLoadingConfig(true);
      }
      setError("");

      const authMode = isPublicAccess ? "anon" : "user";
      let nextGroups = [];
      let nextStatuses = [];
      let nextItemTypes = [];

      if (workspace?.slug) {
        const bootstrap = await fetchWorkspaceBootstrapCached({
          slug: workspace.slug,
          includeItems: false,
        });
        nextGroups = Array.isArray(bootstrap?.groups) ? bootstrap.groups : [];
        nextStatuses = Array.isArray(bootstrap?.statuses) ? bootstrap.statuses : [];
        nextItemTypes = Array.isArray(bootstrap?.item_types) ? bootstrap.item_types : [];
      } else {
        const [statusConfigResult, itemTypesResult] = await Promise.all([
          base44.functions.invoke(
            "getItemStatusConfig",
            { workspace_id: workspaceId },
            { authMode }
          ),
          base44.functions.invoke(
            "listItemTypes",
            { workspace_id: workspaceId, active_only: true },
            { authMode }
          ),
        ]);
        nextGroups = statusConfigResult?.data?.groups || [];
        nextStatuses = statusConfigResult?.data?.statuses || [];
        nextItemTypes = itemTypesResult?.data?.item_types || [];
      }

      setGroups(nextGroups);
      setStatuses(nextStatuses);
      setItemTypes(nextItemTypes);
      lastConfigLoadRef.current = Date.now();

      if (!isPublicAccess && canContributeRole(role)) {
        try {
          const memberResult = await base44.functions.invoke(
            "listWorkspaceMemberDirectory",
            { workspace_id: workspaceId },
            { authMode: "user" }
          );
          setMemberDirectory(memberResult?.data?.members || []);
        } catch (memberError) {
          console.error("Failed to load workspace member directory:", memberError);
          setMemberDirectory([]);
        }
      } else {
        setMemberDirectory([]);
      }
    } catch (configError) {
      console.error("Failed to load item configuration:", configError);
      setError("Unable to load item configuration.");
      if (!hasLocalConfig) {
        setGroups([]);
        setStatuses([]);
        setItemTypes([]);
        setMemberDirectory([]);
      }
    } finally {
      if (!background) {
        setLoadingConfig(false);
      }
    }
  };

  const loadItems = async ({ groupKey = null, statusId = "all", background = false, force = false } = {}) => {
    if (!workspace?.id) return;
    const normalizedGroupKey = groupKey || "all";
    const normalizedStatusId = statusId || "all";
    const requestKey = `${normalizedGroupKey}:${normalizedStatusId}`;
    const hasAnyItems = items.length > 0;
    const useBootstrapItems =
      !force &&
      !bootstrapListConsumedRef.current &&
      bootstrapListKeyRef.current &&
      bootstrapListKeyRef.current === requestKey &&
      hasAnyItems;

    if (useBootstrapItems) {
      bootstrapListConsumedRef.current = true;
      void loadItems({ groupKey, statusId, background: true, force: true });
      return;
    }

    try {
      if (!background || !hasAnyItems) {
        setLoadingItems(true);
      }
      setError("");

      const authMode = isPublicAccess ? "anon" : "user";
      const rows = await fetchWorkspaceItemsCached({
        workspaceId: workspace.id,
        groupKey,
        statusId,
        authMode,
      });
      setItems(rows.map((row) => hydrateItem(row)));
    } catch (itemsError) {
      console.error("Failed to load items:", itemsError);
      setError("Unable to load items.");
      if (!hasAnyItems) {
        setItems([]);
      }
    } finally {
      setLoadingItems(false);
    }
  };

  const loadSystemActivity = async (itemId, { force = false } = {}) => {
    if (!workspace?.id || !itemId) return { ok: false, error: "Item is required." };
    if (!force && systemActivityLoadedItemId === itemId) {
      return { ok: true, activities: systemActivities };
    }
    try {
      setLoadingSystemActivity(true);
      const authMode = isPublicAccess ? "anon" : "user";
      const { data } = await base44.functions.invoke(
        "listItemActivities",
        {
          workspace_id: workspace.id,
          item_id: itemId,
          activity_scope: "system",
          limit: 300,
        },
        { authMode }
      );
      setSystemActivities(Array.isArray(data?.activities) ? data.activities : []);
      setSystemActivityLoadedItemId(itemId);
      return { ok: true, activities: data?.activities || [] };
    } catch (activityError) {
      console.error("Failed to load item system activity:", activityError);
      setSystemActivities([]);
      return { ok: false, error: "Unable to load item activity." };
    } finally {
      setLoadingSystemActivity(false);
    }
  };

  const loadItemActivities = async (item) => {
    if (!workspace?.id || !item?.id) return;
    const hydratedItem = hydrateItem(item);
    const itemId = hydratedItem.id;
    const switchingItem = selectedItem?.id !== itemId;
    setSelectedItem(hydratedItem);
    if (switchingItem) {
      setCommentActivities([]);
      setSystemActivities([]);
      setSystemActivityLoadedItemId(null);
      setItemEngagement(createEmptyItemEngagement());
    }
    try {
      setLoadingActivities(true);
      const authMode = isPublicAccess ? "anon" : "user";
      const { data } = await base44.functions.invoke(
        "listItemActivities",
        {
          workspace_id: workspace.id,
          item_id: itemId,
          activity_scope: "comments",
          limit: 300,
        },
        { authMode }
      );
      setCommentActivities(Array.isArray(data?.activities) ? data.activities : []);
      await loadItemEngagement(itemId);
      if (systemActivityLoadedItemId === itemId) {
        await loadSystemActivity(itemId, { force: true });
      }
    } catch (activityError) {
      console.error("Failed to load item comments:", activityError);
      setCommentActivities([]);
      if (switchingItem) {
        setSystemActivities([]);
        setSystemActivityLoadedItemId(null);
      }
      setItemEngagement(createEmptyItemEngagement());
    } finally {
      setLoadingActivities(false);
    }
  };

  const loadItemEngagement = async (itemId) => {
    if (!workspace?.id || !itemId) return;
    try {
      const authMode = isPublicAccess ? "anon" : "user";
      const { data } = await base44.functions.invoke(
        "getItemEngagement",
        {
          workspace_id: workspace.id,
          item_id: itemId,
        },
        { authMode }
      );
      setItemEngagement({
        watched: Boolean(data?.watched),
        watcher_count: Number(data?.watcher_count || 0),
        item_reactions: Array.isArray(data?.item_reactions) ? data.item_reactions : [],
        item_reaction_count: Number(data?.item_reaction_count || 0),
        comment_reactions:
          data?.comment_reactions && typeof data.comment_reactions === "object"
            ? data.comment_reactions
            : {},
      });
    } catch (engagementError) {
      console.error("Failed to load item engagement:", engagementError);
      setItemEngagement({
        ...createEmptyItemEngagement(),
      });
    }
  };

  const syncItemInState = (nextItem) => {
    if (!nextItem?.id) return;
    const hydrated = hydrateItem(nextItem);
    setItems((prev) => prev.map((item) => (item.id === hydrated.id ? { ...item, ...hydrated } : item)));
    setSelectedItem((prev) => (prev?.id === hydrated.id ? { ...prev, ...hydrated } : prev));
  };

  const saveItem = async ({ payload, previousItem = null }) => {
    if (!workspace?.id) return { ok: false, error: "Workspace is missing." };

    const isContributor = role === "contributor" && !isPublicAccess;
    const defaultFeedbackStatus = (statusesByGroup.feedback || [])
      .find((status) => status?.is_active !== false)
      || (statusesByGroup.feedback || [])[0]
      || null;
    const defaultItemType = itemTypes
      .filter((itemType) => itemType?.is_active !== false)
      .slice()
      .sort((left, right) => (left.display_order || 0) - (right.display_order || 0))[0] || null;
    const contributorDefaultMetadata = getMetadataShapeForGroup("feedback");
    const effectivePayload = { ...payload };

    if (isContributor) {
      if (payload.id) {
        if (!previousItem || previousItem.submitter_id !== currentUserId) {
          return { ok: false, error: "You can only edit feedback you submitted." };
        }
        effectivePayload.status_id = previousItem.status_id;
        effectivePayload.item_type_id = previousItem.item_type_id;
        effectivePayload.metadata = previousItem.metadata || contributorDefaultMetadata;
        effectivePayload.assigned_to = null;
        effectivePayload.title = previousItem.title;
      } else {
        if (!defaultFeedbackStatus) {
          return { ok: false, error: "Feedback status configuration is missing." };
        }
        if (!defaultItemType) {
          return { ok: false, error: "Item type configuration is missing." };
        }
        effectivePayload.status_id = defaultFeedbackStatus.id;
        effectivePayload.item_type_id = defaultItemType.id;
        effectivePayload.metadata = contributorDefaultMetadata;
        effectivePayload.assigned_to = null;
      }
    }

    const selectedStatus = statusById.get(effectivePayload.status_id) || null;
    if (!selectedStatus || selectedStatus.is_active === false) {
      return { ok: false, error: "Selected status is invalid." };
    }

    const metadataValidation = validateMetadata(selectedStatus.group_key, effectivePayload.metadata);
    if (!metadataValidation.valid) {
      return { ok: false, error: metadataValidation.message };
    }

    if (!effectivePayload.item_type_id || !itemTypesById.get(effectivePayload.item_type_id)) {
      return { ok: false, error: "Selected item type is invalid." };
    }

    if (isContributor) {
      if (selectedStatus.group_key !== "feedback") {
        return { ok: false, error: "Contributors can only submit feedback items." };
      }
      if (effectivePayload.id) {
        if (previousItem?.status_id && previousItem.status_id !== effectivePayload.status_id) {
          return { ok: false, error: "Contributors cannot change item status." };
        }
        if (previousItem?.item_type_id && previousItem.item_type_id !== effectivePayload.item_type_id) {
          return { ok: false, error: "Contributors cannot change item type." };
        }
      }
    }

    if (!isAdmin && effectivePayload.assigned_to) {
      return { ok: false, error: "Only admin or owner can assign items." };
    }

    try {
      setSavingItem(true);
      setError("");

      const record = {
        workspace_id: workspace.id,
        status_id: effectivePayload.status_id,
        title: effectivePayload.title,
        description: effectivePayload.description,
        metadata: effectivePayload.metadata,
        visibility: effectivePayload.visibility || "public",
        item_type_id: effectivePayload.item_type_id,
        assigned_to: isAdmin ? effectivePayload.assigned_to || null : null,
      };

      let saved = null;
      if (effectivePayload.id) {
        const { data } = await base44.functions.invoke(
          "updateItem",
          {
            workspace_id: workspace.id,
            item_id: effectivePayload.id,
            status_id: effectivePayload.status_id,
            item_type_id: effectivePayload.item_type_id,
            assigned_to: isAdmin ? effectivePayload.assigned_to || null : null,
            title: effectivePayload.title,
            description: effectivePayload.description,
            metadata: effectivePayload.metadata,
            visibility: effectivePayload.visibility || "public",
          },
          { authMode: "user" }
        );
        saved = data || null;
      } else {
        const { data } = await base44.functions.invoke(
          "createItem",
          {
            workspace_id: workspace.id,
            status_id: effectivePayload.status_id,
            title: effectivePayload.title,
            description: effectivePayload.description || "",
            metadata: effectivePayload.metadata,
            visibility: effectivePayload.visibility || "public",
            item_type_id: effectivePayload.item_type_id,
            assigned_to: isAdmin ? effectivePayload.assigned_to || null : null,
          },
          { authMode: "user" }
        );
        saved = data?.item || data || null;
        if (!saved?.id) {
          return { ok: false, error: "Unable to create item." };
        }
      }

      syncItemInState(saved);
      void invalidateWorkspaceItemQueries(workspace.id);

      return { ok: true, item: saved };
    } catch (saveError) {
      console.error("Failed to save item:", saveError);
      const detail = resolveApiErrorMessage(saveError, "Unable to save item.");
      return { ok: false, error: detail };
    } finally {
      setSavingItem(false);
    }
  };

  const updateInitialPost = async (itemId, nextContent) => {
    if (!workspace?.id || !itemId) {
      return { ok: false, error: "Item is required." };
    }

    const targetItem = selectedItem?.id === itemId
      ? selectedItem
      : items.find((item) => item.id === itemId) || null;

    if (!targetItem || !canEditInitialPost(targetItem)) {
      return { ok: false, error: "You do not have permission to edit this description." };
    }

    try {
      setSavingItem(true);
      const trimmedContent = String(nextContent || "");
      const updatedItem = await base44.entities.Item.update(itemId, {
        description: trimmedContent,
      });
      syncItemInState(updatedItem);

      if ((targetItem.description || "") !== trimmedContent) {
        await base44.entities.ItemActivity.create({
          workspace_id: workspace.id,
          item_id: itemId,
          activity_type: "update",
          content: "Description updated",
          metadata: {},
          author_id: currentUserId,
          author_role: isAdminRole(role) ? "admin" : "user",
        });
      }

      if (selectedItem?.id === itemId) {
        await loadItemActivities(updatedItem);
      }

      return { ok: true, item: updatedItem };
    } catch (updateError) {
      console.error("Failed to update description:", updateError);
      return { ok: false, error: "Unable to update description." };
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (itemId) => {
    if (!itemId) return { ok: false, error: "Item ID is required." };
    const targetItem = items.find((item) => item.id === itemId) || (selectedItem?.id === itemId ? selectedItem : null);
    if (!canDeleteItem(targetItem)) {
      return { ok: false, error: "You do not have permission to delete this item." };
    }
    try {
      setDeletingItemId(itemId);
      await base44.entities.Item.delete(itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
        setCommentActivities([]);
        setSystemActivities([]);
        setSystemActivityLoadedItemId(null);
      }
      void invalidateWorkspaceItemQueries(workspace.id);
      return { ok: true };
    } catch (deleteError) {
      console.error("Failed to delete item:", deleteError);
      return { ok: false, error: "Unable to delete item." };
    } finally {
      setDeletingItemId(null);
    }
  };

  const addComment = async (itemId, comment) => {
    if (!workspace?.id || !itemId || !comment?.trim()) {
      return { ok: false, error: "Comment is required." };
    }
    if (!canComment) {
      return { ok: false, error: "You do not have permission to comment." };
    }

    let authorId = currentUserId;
    if (!authorId) {
      try {
        const user = await base44.auth.me();
        authorId = user?.id || null;
        setCurrentUser(user || null);
      } catch {
        authorId = null;
      }
    }
    if (!authorId) {
      return { ok: false, error: "You must be signed in to comment." };
    }

    try {
      setSavingActivity(true);
      await base44.functions.invoke(
        "createItemActivity",
        {
          workspace_id: workspace.id,
          item_id: itemId,
          activity_type: "comment",
          content: comment.trim(),
          metadata: {},
        },
        { authMode: "user" }
      );

      if (selectedItem?.id === itemId) {
        await loadItemActivities(selectedItem);
      }
      return { ok: true };
    } catch (commentError) {
      console.error("Failed to add comment:", commentError);
      return { ok: false, error: "Unable to add comment." };
    } finally {
      setSavingActivity(false);
    }
  };

  const updateComment = async (commentId, content) => {
    const targetComment = commentActivities.find((activity) => activity.id === commentId) || null;
    if (!targetComment || targetComment.activity_type !== "comment") {
      return { ok: false, error: "Comment not found." };
    }
    if (!canEditComment(targetComment)) {
      return { ok: false, error: "You do not have permission to edit this comment." };
    }
    if (!String(content || "").trim()) {
      return { ok: false, error: "Comment cannot be empty." };
    }

    try {
      setSavingActivity(true);
      const updated = await base44.entities.ItemActivity.update(commentId, {
        content: String(content).trim(),
      });
      setCommentActivities((prev) =>
        prev.map((activity) => (activity.id === commentId ? { ...activity, ...updated } : activity))
      );
      return { ok: true, comment: updated };
    } catch (updateError) {
      console.error("Failed to update comment:", updateError);
      return { ok: false, error: "Unable to update comment." };
    } finally {
      setSavingActivity(false);
    }
  };

  const deleteComment = async (commentId) => {
    const targetComment = commentActivities.find((activity) => activity.id === commentId) || null;
    if (!targetComment || targetComment.activity_type !== "comment") {
      return { ok: false, error: "Comment not found." };
    }
    if (!canDeleteComment(targetComment)) {
      return { ok: false, error: "You do not have permission to delete this comment." };
    }

    try {
      setSavingActivity(true);
      await base44.entities.ItemActivity.delete(commentId);
      setCommentActivities((prev) => prev.filter((activity) => activity.id !== commentId));
      return { ok: true };
    } catch (deleteError) {
      console.error("Failed to delete comment:", deleteError);
      return { ok: false, error: "Unable to delete comment." };
    } finally {
      setSavingActivity(false);
    }
  };

  const toggleItemWatch = async (itemId) => {
    if (!workspace?.id || !itemId) {
      return { ok: false, error: "Item is required." };
    }
    try {
      const { data } = await base44.functions.invoke(
        "toggleItemWatch",
        {
          workspace_id: workspace.id,
          item_id: itemId,
        },
        { authMode: "user" }
      );
      setItemEngagement((prev) => ({
        ...prev,
        watched: Boolean(data?.watched),
        watcher_count: Number(data?.watcher_count || 0),
      }));
      return { ok: true, watched: Boolean(data?.watched) };
    } catch (watchError) {
      console.error("Failed to toggle item watch:", watchError);
      return { ok: false, error: "Unable to update watch state." };
    }
  };

  const toggleItemReaction = async (itemId, emoji) => {
    if (!workspace?.id || !itemId || !emoji) {
      return { ok: false, error: "Reaction is required." };
    }
    const previousListItem = items.find((entry) => entry.id === itemId) || null;
    const previousListSnapshot = previousListItem
      ? {
          reaction_count: Number(previousListItem.reaction_count || 0),
          reaction_summary: normalizeReactionRows(previousListItem.reaction_summary),
        }
      : null;
    const previousSelectedSnapshot = selectedItem?.id === itemId
      ? {
          reaction_count: Number(selectedItem.reaction_count || 0),
          reaction_summary: normalizeReactionRows(selectedItem.reaction_summary),
        }
      : null;
    const previousItemReactions = normalizeReactionRows(itemEngagement.item_reactions);
    const previousReactionCount = Number(itemEngagement.item_reaction_count || 0);
    const optimisticReactions = toggleReactionRows(itemEngagement.item_reactions, emoji);
    const optimisticReactionCount = computeReactionCount(optimisticReactions);
    setItemEngagement((prev) => {
      return {
        ...prev,
        item_reactions: optimisticReactions,
        item_reaction_count: optimisticReactionCount,
      };
    });
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              reaction_count: optimisticReactionCount,
              reaction_summary: optimisticReactions,
            }
          : item
      )
    );
    setSelectedItem((prev) =>
      prev?.id === itemId
        ? {
            ...prev,
            reaction_count: optimisticReactionCount,
            reaction_summary: optimisticReactions,
          }
        : prev
    );
    try {
      const { data } = await base44.functions.invoke(
        "toggleItemReaction",
        {
          workspace_id: workspace.id,
          item_id: itemId,
          emoji,
        },
        { authMode: "user" }
      );
      const serverReactions = normalizeReactionRows(data?.reactions);
      const serverReactionCount = Number(data?.reaction_count || 0);
      setItemEngagement((prev) => ({
        ...prev,
        item_reactions: serverReactions,
        item_reaction_count: serverReactionCount,
      }));
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                reaction_count: serverReactionCount,
                reaction_summary: serverReactions,
              }
            : item
        )
      );
      setSelectedItem((prev) =>
        prev?.id === itemId
          ? {
              ...prev,
              reaction_count: serverReactionCount,
              reaction_summary: serverReactions,
            }
          : prev
      );
      return { ok: true };
    } catch (reactionError) {
      console.error("Failed to toggle item reaction:", reactionError);
      setItemEngagement((prev) => ({
        ...prev,
        item_reactions: previousItemReactions,
        item_reaction_count: previousReactionCount,
      }));
      if (previousListSnapshot) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  reaction_count: previousListSnapshot.reaction_count,
                  reaction_summary: previousListSnapshot.reaction_summary,
                }
              : item
          )
        );
      }
      if (previousSelectedSnapshot) {
        setSelectedItem((prev) =>
          prev?.id === itemId
            ? {
                ...prev,
                reaction_count: previousSelectedSnapshot.reaction_count,
                reaction_summary: previousSelectedSnapshot.reaction_summary,
              }
            : prev
        );
      }
      return { ok: false, error: "Unable to update reaction." };
    }
  };

  const toggleCommentReaction = async (commentId, emoji) => {
    if (!workspace?.id || !commentId || !emoji) {
      return { ok: false, error: "Reaction is required." };
    }
    const previousCommentReactions = normalizeReactionRows(itemEngagement.comment_reactions?.[commentId] || []);
    setItemEngagement((prev) => ({
      ...prev,
      comment_reactions: {
        ...(prev.comment_reactions || {}),
        [commentId]: toggleReactionRows(prev.comment_reactions?.[commentId], emoji),
      },
    }));
    try {
      const { data } = await base44.functions.invoke(
        "toggleCommentReaction",
        {
          workspace_id: workspace.id,
          item_activity_id: commentId,
          emoji,
        },
        { authMode: "user" }
      );
      setItemEngagement((prev) => ({
        ...prev,
        comment_reactions: {
          ...(prev.comment_reactions || {}),
          [commentId]: normalizeReactionRows(data?.reactions),
        },
      }));
      return { ok: true };
    } catch (reactionError) {
      console.error("Failed to toggle comment reaction:", reactionError);
      setItemEngagement((prev) => ({
        ...prev,
        comment_reactions: {
          ...(prev.comment_reactions || {}),
          [commentId]: previousCommentReactions,
        },
      }));
      return { ok: false, error: "Unable to update reaction." };
    }
  };

  const itemActivities = useMemo(
    () => [...commentActivities, ...systemActivities],
    [commentActivities, systemActivities]
  );

  return {
    currentUser,
    currentUserId,
    isAdmin,
    isPublicAccess,
    canComment,
    canManageAssignee: isAdmin,
    groups,
    statuses,
    statusesByGroup,
    statusById,
    itemTypes,
    itemTypesById,
    memberDirectory,
    memberDirectoryById,
    items,
    selectedItem,
    itemActivities,
    thread,
    loadingConfig,
    loadingItems,
    loadingActivities,
    loadingSystemActivity,
    savingItem,
    savingActivity,
    deletingItemId,
    error,
    itemEngagement,
    setError,
    setSelectedItem,
    hydrateItem,
    canEditInitialPost,
    canEditComment,
    canDeleteComment,
    canDeleteItem,
    loadItems,
    loadItemActivities,
    loadSystemActivity,
    saveItem,
    updateInitialPost,
    deleteItem,
    addComment,
    updateComment,
    deleteComment,
    loadItemEngagement,
    systemActivityLoadedItemId,
    toggleItemWatch,
    toggleItemReaction,
    toggleCommentReaction,
  };
}
