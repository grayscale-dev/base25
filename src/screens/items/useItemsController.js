import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  DEFAULT_GROUP_STATUSES,
  ITEM_GROUP_KEYS,
  ITEM_GROUP_LABELS,
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

function resolveStatusLabel(statusesByGroup, statusKey, preferredGroupKey = null) {
  if (!statusKey) return "Unknown";

  if (preferredGroupKey && statusesByGroup[preferredGroupKey]) {
    const inGroup = statusesByGroup[preferredGroupKey].find(
      (status) => status.status_key === statusKey
    );
    if (inGroup?.label) return inGroup.label;
  }

  for (const groupStatuses of Object.values(statusesByGroup)) {
    const match = groupStatuses.find((status) => status.status_key === statusKey);
    if (match?.label) return match.label;
  }

  return String(statusKey);
}

export function useItemsController({ workspace, role, isPublicAccess }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [statuses, setStatuses] = useState([]);
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
  const isAdmin = role === "admin" && !isPublicAccess;
  const canComment = !isPublicAccess && (role === "admin" || role === "contributor");

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

  const canEditInitialPost = (item) => {
    if (isAdmin) return true;
    return Boolean(currentUserId && item?.submitter_id && item.submitter_id === currentUserId);
  };

  const canEditComment = (activity) =>
    Boolean(currentUserId && activity?.author_id && activity.author_id === currentUserId);

  const canDeleteComment = () => false;

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
    void loadStatusConfiguration(workspace.id);
  }, [workspace?.id]);

  const loadStatusConfiguration = async (workspaceId) => {
    try {
      setLoadingConfig(true);
      setError("");

      const [groupRows, statusRows] = await Promise.all([
        base44.entities.ItemStatusGroup.filter({ board_id: workspaceId }, "display_order"),
        base44.entities.ItemStatus.filter({ board_id: workspaceId }, "display_order"),
      ]);

      if (groupRows.length === 0) {
        if (!isAdmin) {
          setError("Item status groups are not configured yet.");
          setGroups([]);
          setStatuses([]);
          return;
        }

        const seededGroups = [];
        const seededStatuses = [];

        for (const [index, groupKey] of ITEM_GROUP_KEYS.entries()) {
          const groupRecord = await base44.entities.ItemStatusGroup.create({
            board_id: workspaceId,
            group_key: groupKey,
            display_name: ITEM_GROUP_LABELS[groupKey],
            display_order: index,
          });
          seededGroups.push(groupRecord);

          for (const [statusIndex, status] of (DEFAULT_GROUP_STATUSES[groupKey] || []).entries()) {
            const statusRecord = await base44.entities.ItemStatus.create({
              board_id: workspaceId,
              group_key: groupKey,
              status_key: status.key,
              label: status.label,
              display_order: statusIndex,
              is_active: true,
            });
            seededStatuses.push(statusRecord);
          }
        }

        setGroups(seededGroups);
        setStatuses(seededStatuses);
      } else {
        setGroups(groupRows);
        setStatuses(statusRows);
      }
    } catch (configError) {
      console.error("Failed to load item status configuration:", configError);
      setError("Unable to load item status configuration.");
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadItems = async ({ groupKey = null, statusKey = "all" } = {}) => {
    if (!workspace?.id) return;
    try {
      setLoadingItems(true);
      setError("");

      const conditions = { board_id: workspace.id };
      if (groupKey) {
        conditions.group_key = groupKey;
      }
      if (statusKey && statusKey !== "all") {
        conditions.status_key = statusKey;
      }

      const rows = await base44.entities.Item.filter(conditions, "-created_at");
      setItems(rows || []);
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
    setSelectedItem(item);
    try {
      setLoadingActivities(true);
      const rows = await base44.entities.ItemActivity.filter(
        {
          board_id: workspace.id,
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
    setItems((prev) => prev.map((item) => (item.id === nextItem.id ? { ...item, ...nextItem } : item)));
    setSelectedItem((prev) => (prev?.id === nextItem.id ? { ...prev, ...nextItem } : prev));
  };

  const saveItem = async ({ payload, previousItem = null }) => {
    if (!workspace?.id) return { ok: false, error: "Workspace is missing." };

    const statusOptions = statusesByGroup[payload.group_key] || [];
    const statusExists = statusOptions.some((status) => status.status_key === payload.status_key);
    if (!statusExists) {
      return { ok: false, error: "Selected status is invalid for this group." };
    }

    const metadataValidation = validateMetadata(payload.group_key, payload.metadata);
    if (!metadataValidation.valid) {
      return { ok: false, error: metadataValidation.message };
    }

    try {
      setSavingItem(true);
      setError("");

      const record = {
        board_id: workspace.id,
        group_key: payload.group_key,
        status_key: payload.status_key,
        title: payload.title,
        description: payload.description,
        metadata: payload.metadata,
        visibility: payload.visibility || "public",
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

      if (payload.id && saved && previousItem?.group_key && previousItem.group_key !== payload.group_key) {
        await base44.entities.ItemActivity.create({
          board_id: workspace.id,
          item_id: saved.id,
          activity_type: "group_change",
          content: `Moved from ${getGroupLabel(previousItem.group_key)} to ${getGroupLabel(payload.group_key)}`,
          metadata: {
            from_group: previousItem.group_key,
            to_group: payload.group_key,
          },
          author_id: currentUserId,
          author_role: role === "admin" ? "admin" : "user",
        });
      }

      if (payload.id && saved && previousItem?.status_key && previousItem.status_key !== payload.status_key) {
        const fromStatusLabel = resolveStatusLabel(
          statusesByGroup,
          previousItem.status_key,
          previousItem.group_key || payload.group_key
        );
        const toStatusLabel = resolveStatusLabel(
          statusesByGroup,
          payload.status_key,
          payload.group_key
        );

        await base44.entities.ItemActivity.create({
          board_id: workspace.id,
          item_id: saved.id,
          activity_type: "status_change",
          content: `Status changed from ${fromStatusLabel} to ${toStatusLabel}`,
          metadata: {
            from_status: previousItem.status_key,
            to_status: payload.status_key,
          },
          author_id: currentUserId,
          author_role: role === "admin" ? "admin" : "user",
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
          board_id: workspace.id,
          item_id: itemId,
          activity_type: "update",
          content: "Initial post updated",
          metadata: {},
          author_id: currentUserId,
          author_role: role === "admin" ? "admin" : "user",
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
        board_id: workspace.id,
        item_id: itemId,
        activity_type: "comment",
        content: comment.trim(),
        metadata: {},
        author_id: authorId,
        author_role: role === "admin" ? "admin" : "user",
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
    return { ok: false, error: "Deleting comments is disabled." };
  };

  return {
    currentUser,
    currentUserId,
    isAdmin,
    canComment,
    groups,
    statuses,
    statusesByGroup,
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
    canEditInitialPost,
    canEditComment,
    canDeleteComment,
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
