import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { canContributeRole, isAdminRole } from "@/lib/roles";
import {
  ITEM_GROUP_KEYS,
  ITEM_GROUP_LABELS,
  getGroupColor,
  getGroupLabel,
  validateMetadata,
} from "@/lib/item-groups";

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

export function useItemsController({ workspace, role, isPublicAccess }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);
  const [memberDirectory, setMemberDirectory] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemActivities, setItemActivities] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [error, setError] = useState("");

  const currentUserId = currentUser?.id || null;
  const isAdmin = isAdminRole(role) && !isPublicAccess;
  const canComment = !isPublicAccess && canContributeRole(role);

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
    const statusRecord = statusById.get(item.status_id) || null;
    const groupKey = statusRecord?.group_key || item.group_key;
    const groupLabel = ITEM_GROUP_LABELS[groupKey] || getGroupLabel(groupKey);
    const groupColor = groups.find((group) => group.group_key === groupKey)?.color_hex || getGroupColor(groupKey);
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
    if (isAdmin) return true;
    return Boolean(
      !isPublicAccess &&
      role === "contributor" &&
      item.group_key === "feedback" &&
      currentUserId &&
      item.submitter_id &&
      item.submitter_id === currentUserId
    );
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

    const comments = itemActivities
      .filter((activity) => activity.activity_type === "comment")
      .slice()
      .sort(sortByCreatedAsc)
      .map((activity) => ({
        ...activity,
        created_at_resolved: resolveTimestamp(activity),
        author_label: resolveActivityAuthorLabel(activity, currentUserId),
        can_edit: canEditComment(activity),
        can_delete: canDeleteComment(activity),
      }));

    const systemActivity = itemActivities
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
  }, [selectedItem, itemActivities, currentUserId, isAdmin]);

  useEffect(() => {
    if (!workspace?.id) {
      setLoadingConfig(false);
      setError("Workspace context is missing.");
      return;
    }
    void loadWorkspaceConfig(workspace.id);
  }, [workspace?.id, role, isPublicAccess]);

  useEffect(() => {
    if (!workspace?.id) return;
    setItems((prev) => prev.map((item) => hydrateItem(item)));
    setSelectedItem((prev) => (prev ? hydrateItem(prev) : prev));
  }, [groups, statuses, itemTypes, memberDirectory]);

  const loadWorkspaceConfig = async (workspaceId) => {
    try {
      setLoadingConfig(true);
      setError("");

      const authMode = isPublicAccess ? "anon" : "user";

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

      const nextGroups = statusConfigResult?.data?.groups || [];
      const nextStatuses = statusConfigResult?.data?.statuses || [];
      const nextItemTypes = itemTypesResult?.data?.item_types || [];

      setGroups(nextGroups);
      setStatuses(nextStatuses);
      setItemTypes(nextItemTypes);

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
      setGroups([]);
      setStatuses([]);
      setItemTypes([]);
      setMemberDirectory([]);
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadItems = async ({ groupKey = null, statusId = "all" } = {}) => {
    if (!workspace?.id) return;
    try {
      setLoadingItems(true);
      setError("");

      const authMode = isPublicAccess ? "anon" : "user";
      const payload = { workspace_id: workspace.id };
      if (groupKey) payload.group_key = groupKey;
      if (statusId && statusId !== "all") payload.status_id = statusId;

      const { data } = await base44.functions.invoke("listItems", payload, { authMode });
      const rows = data?.items || [];
      setItems(rows.map((row) => hydrateItem(row)));
    } catch (itemsError) {
      console.error("Failed to load items:", itemsError);
      setError("Unable to load items.");
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const loadItemActivities = async (item) => {
    if (!workspace?.id || !item?.id) return;
    setSelectedItem(hydrateItem(item));
    try {
      setLoadingActivities(true);
      const rows = await base44.entities.ItemActivity.filter(
        {
          workspace_id: workspace.id,
          item_id: item.id,
        },
        "-created_at"
      );
      setItemActivities(rows || []);
    } catch (activityError) {
      console.error("Failed to load item activities:", activityError);
      setItemActivities([]);
    } finally {
      setLoadingActivities(false);
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

    const selectedStatus = statusById.get(payload.status_id) || null;
    if (!selectedStatus || selectedStatus.is_active === false) {
      return { ok: false, error: "Selected status is invalid." };
    }

    const metadataValidation = validateMetadata(selectedStatus.group_key, payload.metadata);
    if (!metadataValidation.valid) {
      return { ok: false, error: metadataValidation.message };
    }

    if (!payload.item_type_id || !itemTypesById.get(payload.item_type_id)) {
      return { ok: false, error: "Selected item type is invalid." };
    }

    const isContributor = role === "contributor" && !isPublicAccess;
    if (isContributor) {
      if (selectedStatus.group_key !== "feedback") {
        return { ok: false, error: "Contributors can only submit feedback items." };
      }
      if (payload.id) {
        if (previousItem?.submitter_id !== currentUserId) {
          return { ok: false, error: "You can only edit feedback you submitted." };
        }
        if (previousItem?.status_id && previousItem.status_id !== payload.status_id) {
          return { ok: false, error: "Contributors cannot change item status." };
        }
      }
    }

    if (!isAdmin && payload.assigned_to) {
      return { ok: false, error: "Only admin or owner can assign items." };
    }

    try {
      setSavingItem(true);
      setError("");

      const record = {
        workspace_id: workspace.id,
        status_id: payload.status_id,
        title: payload.title,
        description: payload.description,
        metadata: payload.metadata,
        visibility: payload.visibility || "public",
        item_type_id: payload.item_type_id,
        assigned_to: isAdmin ? payload.assigned_to || null : null,
      };

      let saved = null;
      if (payload.id) {
        saved = await base44.entities.Item.update(payload.id, record);
      } else {
        let submitterId = currentUserId;
        let submitterEmail = currentUser?.email || null;
        if (!submitterId) {
          try {
            const user = await base44.auth.me();
            submitterId = user?.id || null;
            submitterEmail = user?.email || null;
            setCurrentUser(user || null);
          } catch {
            submitterId = null;
            submitterEmail = null;
          }
        }

        saved = await base44.entities.Item.create({
          ...record,
          submitter_email: submitterEmail,
          submitter_id: submitterId,
        });
      }

      syncItemInState(saved);

      if (payload.id && saved && previousItem?.group_key && previousItem.group_key !== selectedStatus.group_key) {
        await base44.entities.ItemActivity.create({
          workspace_id: workspace.id,
          item_id: saved.id,
          activity_type: "group_change",
          content: `Moved from ${getGroupLabel(previousItem.group_key)} to ${getGroupLabel(selectedStatus.group_key)}`,
          metadata: {
            from_group: previousItem.group_key,
            to_group: selectedStatus.group_key,
          },
          author_id: currentUserId,
          author_role: isAdminRole(role) ? "admin" : "user",
        });
      }

      if (payload.id && saved && previousItem?.status_id && previousItem.status_id !== payload.status_id) {
        const fromStatus = statusById.get(previousItem.status_id);
        const toStatus = statusById.get(payload.status_id);
        const fromStatusLabel = fromStatus?.label || previousItem.status_label || "Unknown";
        const toStatusLabel = toStatus?.label || saved.status_label || "Unknown";

        await base44.entities.ItemActivity.create({
          workspace_id: workspace.id,
          item_id: saved.id,
          activity_type: "status_change",
          content: `Status changed from ${fromStatusLabel} to ${toStatusLabel}`,
          metadata: {
            from_status_id: previousItem.status_id,
            to_status_id: payload.status_id,
          },
          author_id: currentUserId,
          author_role: isAdminRole(role) ? "admin" : "user",
        });
      }

      return { ok: true, item: saved };
    } catch (saveError) {
      console.error("Failed to save item:", saveError);
      return { ok: false, error: "Unable to save item." };
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
      return { ok: false, error: "You do not have permission to edit this initial post." };
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
          content: "Initial post updated",
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
      console.error("Failed to update initial post:", updateError);
      return { ok: false, error: "Unable to update initial post." };
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
        setItemActivities([]);
      }
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
      await base44.entities.ItemActivity.create({
        workspace_id: workspace.id,
        item_id: itemId,
        activity_type: "comment",
        content: comment.trim(),
        metadata: {},
        author_id: authorId,
        author_role: isAdminRole(role) ? "admin" : "user",
      });

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
    const targetComment = itemActivities.find((activity) => activity.id === commentId) || null;
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
      setItemActivities((prev) =>
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
    const targetComment = itemActivities.find((activity) => activity.id === commentId) || null;
    if (!targetComment || targetComment.activity_type !== "comment") {
      return { ok: false, error: "Comment not found." };
    }
    if (!canDeleteComment(targetComment)) {
      return { ok: false, error: "You do not have permission to delete this comment." };
    }

    try {
      setSavingActivity(true);
      await base44.entities.ItemActivity.delete(commentId);
      setItemActivities((prev) => prev.filter((activity) => activity.id !== commentId));
      return { ok: true };
    } catch (deleteError) {
      console.error("Failed to delete comment:", deleteError);
      return { ok: false, error: "Unable to delete comment." };
    } finally {
      setSavingActivity(false);
    }
  };

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
    savingItem,
    savingActivity,
    deletingItemId,
    error,
    setError,
    setSelectedItem,
    hydrateItem,
    canEditInitialPost,
    canEditComment,
    canDeleteComment,
    canDeleteItem,
    loadItems,
    loadItemActivities,
    saveItem,
    updateInitialPost,
    deleteItem,
    addComment,
    updateComment,
    deleteComment,
  };
}
