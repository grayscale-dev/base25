"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/lib/router";
import {
  Settings,
  Users,
  Key,
  Trash2,
  Save,
  Copy,
  Check,
  Plus,
  User,
  CreditCard,
  Eye,
  EyeOff,
  RefreshCw,
  Pencil,
  GripVertical,
  Loader2,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import PageLoadingState from "@/components/common/PageLoadingState";
import { PageHeader, PageShell } from "@/components/common/PageScaffold";
import { StatePanel } from "@/components/common/StateDisplay";
import { cn } from "@/lib/utils";
import {
  consumeWorkspaceSettingsTabIntent,
  getWorkspaceSession,
  setWorkspaceSession,
} from "@/lib/workspace-session";
import { workspaceDefaultUrl, workspaceUrl } from "@/components/utils/workspaceUrl";
import AccountSettingsPanel from "@/components/workspace/AccountSettingsPanel";
import WorkspaceApiPanel from "@/components/workspace/WorkspaceApiPanel";
import { useToast } from "@/components/ui/use-toast";
import RelativeDate from "@/components/common/RelativeDate";
import { openStripeBilling } from "@/lib/openStripeBilling";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_GROUP_STATUSES,
  ITEM_GROUP_COLORS,
  ITEM_GROUP_KEYS,
  ITEM_GROUP_LABELS,
} from "@/lib/item-groups";
import { isAdminRole, isOwnerRole } from "@/lib/roles";

const SETTINGS_TABS = ["my-account", "general", "access", "status-groups", "item-types", "api"];

function byDisplayOrder(a, b) {
  return (a.display_order || 0) - (b.display_order || 0);
}

function getErrorStatus(error) {
  if (!error) return null;
  return error.status ?? error.context?.status ?? error.response?.status ?? null;
}

function getDefaultSettingsTab(role) {
  return isAdminRole(role) ? "general" : "my-account";
}

function canAccessSettingsTab(tab, role) {
  if (!SETTINGS_TABS.includes(tab)) return false;
  if (tab === "my-account") return true;
  if (!isAdminRole(role)) return false;
  return true;
}

export default function WorkspaceSettings() {
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState(null);
  const [role, setRole] = useState("contributor");
  const [roleInitialized, setRoleInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialLoadError, setInitialLoadError] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("restricted");
  const [settings, setSettings] = useState({});
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0f172a");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [slugError, setSlugError] = useState("");

  const [members, setMembers] = useState([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [updatingMemberId, setUpdatingMemberId] = useState(null);
  const [memberPendingRemoval, setMemberPendingRemoval] = useState(null);
  const [accessCodeStatus, setAccessCodeStatus] = useState({
    hasCode: false,
    maskedCode: "",
    accessCode: null,
    createdAt: null,
  });
  const [loadingAccessCode, setLoadingAccessCode] = useState(false);
  const [rotatingAccessCode, setRotatingAccessCode] = useState(false);
  const [showRotateAccessCodeDialog, setShowRotateAccessCodeDialog] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [statusGroups, setStatusGroups] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [statusDrafts, setStatusDrafts] = useState({});
  const [savingGroupColorId, setSavingGroupColorId] = useState(null);
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editingStatusLabel, setEditingStatusLabel] = useState("");
  const [savingStatusId, setSavingStatusId] = useState(null);
  const [showAddStatusDialog, setShowAddStatusDialog] = useState(false);
  const [addStatusGroupKey, setAddStatusGroupKey] = useState("");
  const [newStatusLabel, setNewStatusLabel] = useState("");
  const [creatingStatus, setCreatingStatus] = useState(false);
  const [statusPendingDelete, setStatusPendingDelete] = useState(null);
  const [deletingStatusId, setDeletingStatusId] = useState(null);
  const [statusMovePending, setStatusMovePending] = useState(null);
  const [statusMoveTargetId, setStatusMoveTargetId] = useState("");
  const [savingStatusMove, setSavingStatusMove] = useState(false);
  const [itemTypes, setItemTypes] = useState([]);
  const [editingItemTypeId, setEditingItemTypeId] = useState(null);
  const [editingItemTypeLabel, setEditingItemTypeLabel] = useState("");
  const [reorderingItemTypeId, setReorderingItemTypeId] = useState(null);
  const [deletingItemTypeId, setDeletingItemTypeId] = useState(null);
  const [savingItemType, setSavingItemType] = useState(false);
  const [showDeleteWorkspaceDialog, setShowDeleteWorkspaceDialog] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [activeTab, setActiveTab] = useState("my-account");
  const [openingBilling, setOpeningBilling] = useState(false);
  const { toast } = useToast();

  const notifyStatus = (tone, message) => {
    if (!message) return;
    const normalizedTone = String(tone || "").toLowerCase();
    const variant = normalizedTone === "danger"
      ? "error"
      : normalizedTone === "warning"
        ? "warning"
        : normalizedTone === "info" || normalizedTone === "neutral"
          ? "info"
          : "success";
    toast({
      title: normalizedTone === "danger" ? "Action failed" : "Success",
      description: message,
      variant,
    });
  };

  useEffect(() => {
    const { workspace: storedWorkspace, role: storedRole } = getWorkspaceSession();
    if (!storedWorkspace) {
      navigate(createPageUrl("Workspaces"));
      return;
    }

    const resolvedRole = storedRole || "contributor";
    const adminRole = isAdminRole(resolvedRole);
    const requestedInitialTab = consumeWorkspaceSettingsTabIntent();
    const initialTab =
      requestedInitialTab && canAccessSettingsTab(requestedInitialTab, resolvedRole)
        ? requestedInitialTab
        : getDefaultSettingsTab(resolvedRole);

    setRole(resolvedRole);
    setActiveTab(initialTab);
    setWorkspace(storedWorkspace);
    setName(storedWorkspace.name);
    setSlug(storedWorkspace.slug);
    setDescription(storedWorkspace.description || "");
    setVisibility(storedWorkspace.visibility || "restricted");
    setSettings(storedWorkspace.settings || {});
    setLogoUrl(storedWorkspace.logo_url || "");
    setPrimaryColor(storedWorkspace.primary_color || "#0f172a");
    if (adminRole) {
      void loadAll(storedWorkspace.id);
      setRoleInitialized(true);
      return;
    }
    setRoleInitialized(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!roleInitialized) return;
    if (!canAccessSettingsTab(activeTab, role)) {
      setActiveTab(getDefaultSettingsTab(role));
    }
  }, [activeTab, role, roleInitialized]);

  const handleTabChange = (nextTab) => {
    if (!roleInitialized) return;
    if (!canAccessSettingsTab(nextTab, role)) {
      return;
    }
    setActiveTab(nextTab);
  };

  const groupedStatuses = useMemo(() => {
    const next = {};
    ITEM_GROUP_KEYS.forEach((groupKey) => {
      next[groupKey] = [];
    });
    statuses.forEach((status) => {
      if (!next[status.group_key]) {
        next[status.group_key] = [];
      }
      next[status.group_key].push(status);
    });
    Object.values(next).forEach((values) => values.sort(byDisplayOrder));
    return next;
  }, [statuses]);

  const filteredMembers = useMemo(() => {
    const query = memberSearchQuery.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const nameText = [
        member.first_name,
        member.last_name,
        member.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const emailText = String(member.email || "").toLowerCase();
      return nameText.includes(query) || emailText.includes(query);
    });
  }, [memberSearchQuery, members]);

  const ownerCount = useMemo(
    () => members.filter((member) => member.role === "owner").length,
    [members]
  );

  const statusMoveTargetOptions = useMemo(() => {
    if (!statusMovePending?.status?.id) return [];
    return statusGroups
      .slice()
      .sort(byDisplayOrder)
      .flatMap((group) => {
        const groupLabel = ITEM_GROUP_LABELS[group.group_key] || group.display_name || group.group_key;
        return (groupedStatuses[group.group_key] || [])
          .filter((status) => status.id !== statusMovePending.status.id)
          .map((status) => ({
            id: status.id,
            label: status.label || "Unnamed status",
            groupKey: group.group_key,
            groupLabel,
          }));
      });
  }, [statusMovePending, statusGroups, groupedStatuses]);

  const getMemberDisplayName = (member) => {
    const firstName = String(member?.first_name || "").trim();
    const lastName = String(member?.last_name || "").trim();
    const fullName = String(member?.full_name || "").trim();
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    if (fullName) return fullName;
    const localPart = String(member?.email || "").split("@")[0] || "";
    if (!localPart) return "Member";
    return localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((value) => value.charAt(0).toUpperCase() + value.slice(1))
      .join(" ");
  };

  const loadAll = async (workspaceId) => {
    try {
      setInitialLoadError("");
      setLoading(true);

      const [rolesData, accessCodeData] = await Promise.all([
        loadMembers(workspaceId),
        loadAccessCode({ workspaceId, reveal: false }),
      ]);

      setMembers(rolesData);
      setAccessCodeStatus(accessCodeData);

      await Promise.all([loadStatusConfig(workspaceId), loadItemTypes(workspaceId)]);
    } catch (error) {
      console.error("Failed to load workspace settings:", error);
      const status = getErrorStatus(error);
      if (status === 401) {
        setInitialLoadError("Your session is invalid for this environment. Sign out and sign in again.");
      } else {
        setInitialLoadError("Unable to load workspace settings. Please retry.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (workspaceId) => {
    const { data } = await base44.functions.invoke(
      "listWorkspaceMembers",
      { workspace_id: workspaceId },
      { authMode: "user" }
    );
    const rolesData = data?.members || [];
    return rolesData.sort((left, right) => {
      if (left.role === "owner" && right.role !== "owner") return -1;
      if (left.role !== "owner" && right.role === "owner") return 1;
      return String(left.email || "").localeCompare(String(right.email || ""));
    });
  };

  const loadAccessCode = async ({ workspaceId, reveal }) => {
    const { data } = await base44.functions.invoke(
      "getWorkspaceAccessCodeStatus",
      { workspace_id: workspaceId, reveal: Boolean(reveal) },
      { authMode: "user" }
    );

    return {
      hasCode: Boolean(data?.has_code),
      maskedCode: data?.masked_code || "",
      accessCode: data?.access_code || null,
      createdAt: data?.created_at || null,
    };
  };

  const loadStatusConfig = async (workspaceId) => {
    const { data } = await base44.functions.invoke(
      "getItemStatusConfig",
      { workspace_id: workspaceId },
      { authMode: "user" }
    );

    const groupRows = data?.groups || [];
    const statusRows = data?.statuses || [];

    if (groupRows.length > 0) {
      setStatusGroups(groupRows.sort(byDisplayOrder));
      setStatuses(statusRows.sort(byDisplayOrder));
      return;
    }

    const createdGroups = [];
    const createdStatuses = [];

    for (const [index, groupKey] of ITEM_GROUP_KEYS.entries()) {
      const group = await base44.entities.ItemStatusGroup.create({
        workspace_id: workspaceId,
        group_key: groupKey,
        display_name: ITEM_GROUP_LABELS[groupKey],
        color_hex: ITEM_GROUP_COLORS[groupKey] || "#0F172A",
        display_order: index,
      });
      createdGroups.push(group);

      for (const [statusIndex, status] of (DEFAULT_GROUP_STATUSES[groupKey] || []).entries()) {
        const created = await base44.entities.ItemStatus.create({
          workspace_id: workspaceId,
          group_key: groupKey,
          label: status.label,
          display_order: statusIndex,
          is_active: true,
        });
        createdStatuses.push(created);
      }
    }

    setStatusGroups(createdGroups.sort(byDisplayOrder));
    setStatuses(createdStatuses.sort(byDisplayOrder));
  };

  const loadItemTypes = async (workspaceId) => {
    const { data } = await base44.functions.invoke(
      "listItemTypes",
      { workspace_id: workspaceId, active_only: false },
      { authMode: "user" }
    );

    const rows = (data?.item_types || []).sort(byDisplayOrder);
    setItemTypes(rows);
  };

  const validateSlug = (value) => {
    setSlugError("");
    if (value.length < 3 || value.length > 50) {
      return "Slug must be between 3 and 50 characters.";
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      return "Slug can only contain lowercase letters, numbers, and hyphens.";
    }
    if (value.startsWith("-") || value.endsWith("-")) {
      return "Slug cannot start or end with a hyphen.";
    }
    if (value.includes("--")) {
      return "Slug cannot contain consecutive hyphens.";
    }
    return null;
  };

  const handleSaveSettings = async () => {
    if (!workspace) return;

    if (slug !== workspace.slug) {
      const validationError = validateSlug(slug);
      if (validationError) {
        setSlugError(validationError);
        return;
      }
      const existing = await base44.entities.Workspace.filter({ slug });
      if (existing.length > 0 && existing[0].id !== workspace.id) {
        setSlugError("This slug is already taken.");
        return;
      }
    }

    setSaving(true);
    try {
      const { data: updatedWorkspaceRecord } = await base44.functions.invoke(
        "updateWorkspaceSettings",
        {
          workspace_id: workspace.id,
          name,
          slug,
          description,
          visibility,
          settings,
          logo_url: logoUrl,
          primary_color: primaryColor,
        },
        { authMode: "user" }
      );

      const updatedWorkspace = updatedWorkspaceRecord || {
        ...workspace,
        name,
        slug,
        description,
        visibility,
        settings,
        logo_url: logoUrl,
        primary_color: primaryColor,
      };
      setWorkspace(updatedWorkspace);
      setWorkspaceSession({ workspace: updatedWorkspace, role, isPublicAccess: false });
      notifyStatus("success", "Workspace settings saved.");

      if (slug !== workspace.slug) {
        navigate(workspaceDefaultUrl(slug, role, false));
      }
    } catch (error) {
      console.error("Failed to save workspace settings:", error);
      const status = getErrorStatus(error);
      if (status === 403) {
        notifyStatus("danger", "Only the workspace owner can change the workspace name.");
      } else {
        notifyStatus("danger", "Failed to save settings. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBilling = async () => {
    if (!workspace?.id || !isOwner) return;
    setOpeningBilling(true);
    try {
      const result = await openStripeBilling({
        workspaceId: workspace.id,
        returnUrl: window.location.href,
      });
      if (!result.ok) {
        notifyStatus("danger", result.error || "Unable to open Stripe billing.");
      }
    } catch (error) {
      console.error("Failed to open Stripe billing:", error);
      notifyStatus("danger", "Unable to open Stripe billing right now.");
    } finally {
      setOpeningBilling(false);
    }
  };

  const handleCopyUrl = () => {
    if (!workspace?.slug) return;
    const fullUrl = `${window.location.origin}${workspaceUrl(workspace.slug, "feedback")}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1800);
    notifyStatus("success", "Workspace URL copied.");
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url: uploadedUrl } = await base44.integrations.Core.UploadFile({ file });
      setLogoUrl(uploadedUrl);
      notifyStatus("success", "Logo uploaded. Save changes to publish it.");
    } catch (error) {
      console.error("Failed to upload logo:", error);
      notifyStatus("danger", "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUpdateMemberRole = async (memberId, nextRole) => {
    setUpdatingMemberId(memberId);
    try {
      await base44.functions.invoke(
        "updateWorkspaceMemberRole",
        { workspace_id: workspace.id, member_id: memberId, role: nextRole },
        { authMode: "user" }
      );
      const refreshed = await loadMembers(workspace.id);
      setMembers(refreshed);
      notifyStatus("success", nextRole === "owner" ? "Owner role granted." : "Member role updated.");
    } catch (error) {
      console.error("Failed to update member role:", error);
      const status = getErrorStatus(error);
      const code = error?.context?.body?.code ?? error?.body?.code ?? "";
      if (status === 409) {
        notifyStatus("danger", "Add another owner before removing owner access.");
      } else if (status === 403 && code === "OWNER_REQUIRED_FOR_OWNER_ASSIGNMENT") {
        notifyStatus("danger", "Only owners can grant owner role.");
      } else if (status === 403 && code === "OWNER_REQUIRED_FOR_OWNER_MUTATION") {
        notifyStatus("danger", "Only owners can modify owner roles.");
      } else {
        notifyStatus("danger", "Failed to update member role.");
      }
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberPendingRemoval) return;

    setUpdatingMemberId(memberPendingRemoval.id);
    try {
      await base44.functions.invoke(
        "removeWorkspaceMember",
        { workspace_id: workspace.id, member_id: memberPendingRemoval.id },
        { authMode: "user" }
      );
      const refreshed = await loadMembers(workspace.id);
      setMembers(refreshed);
      notifyStatus("success", "Member removed.");
    } catch (error) {
      console.error("Failed to remove member:", error);
      const status = getErrorStatus(error);
      const code = error?.context?.body?.code ?? error?.body?.code ?? "";
      if (status === 409) {
        notifyStatus("danger", "Add another owner before removing the last owner.");
      } else if (status === 403 && code === "OWNER_REQUIRED_FOR_OWNER_REMOVAL") {
        notifyStatus("danger", "Only owners can remove owners.");
      } else {
        notifyStatus("danger", "Failed to remove member.");
      }
    } finally {
      setUpdatingMemberId(null);
      setMemberPendingRemoval(null);
    }
  };

  const handleToggleRevealAccessCode = async () => {
    if (!workspace?.id) return;
    if (accessCodeStatus.accessCode) {
      setAccessCodeStatus((prev) => ({ ...prev, accessCode: null }));
      return;
    }

    setLoadingAccessCode(true);
    try {
      const nextStatus = await loadAccessCode({ workspaceId: workspace.id, reveal: true });
      setAccessCodeStatus(nextStatus);
    } catch (error) {
      console.error("Failed to reveal access code:", error);
      const status = getErrorStatus(error);
      if (status === 401) {
        notifyStatus("danger", "Your session expired. Sign in again and retry.");
      } else if (status === 403) {
        notifyStatus("danger", "Only workspace staff can view access code details.");
      } else {
        notifyStatus("danger", "Failed to load access code.");
      }
    } finally {
      setLoadingAccessCode(false);
    }
  };

  const handleRotateAccessCode = async () => {
    if (!workspace?.id) return;
    setRotatingAccessCode(true);
    try {
      const { data } = await base44.functions.invoke(
        "setWorkspaceAccessCode",
        { workspace_id: workspace.id, action: "rotate" },
        { authMode: "user" }
      );
      setAccessCodeStatus({
        hasCode: true,
        maskedCode: data?.masked_code || "",
        accessCode: data?.access_code || null,
        createdAt: data?.rotated_at || new Date().toISOString(),
      });
      setShowRotateAccessCodeDialog(false);
      notifyStatus("success", "Workspace code rotated. The previous code is no longer valid.");
    } catch (error) {
      console.error("Failed to rotate access code:", error);
      notifyStatus("danger", "Failed to rotate workspace code.");
    } finally {
      setRotatingAccessCode(false);
    }
  };

  const handleCopyAccessCode = () => {
    const codeToCopy = accessCodeStatus.accessCode || "";
    if (!codeToCopy) {
      notifyStatus("danger", "Reveal the workspace code before copying it.");
      return;
    }
    navigator.clipboard.writeText(codeToCopy);
    notifyStatus("success", "Workspace code copied.");
  };

  const handleGroupColorSave = async (group, nextColor) => {
    if (!workspace?.id || !group?.group_key) return;
    const normalizedColor = String(nextColor || "").trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(normalizedColor)) {
      notifyStatus("danger", "Color must be a valid hex value like #2563EB.");
      return;
    }
    try {
      setSavingGroupColorId(group.id);
      const { data } = await base44.functions.invoke(
        "upsertItemStatusGroup",
        {
          workspace_id: workspace.id,
          group_key: group.group_key,
          color_hex: normalizedColor,
          display_order: group.display_order || 0,
        },
        { authMode: "user" }
      );
      setStatusGroups((prev) =>
        prev.map((entry) => (entry.id === group.id ? { ...entry, ...(data || {}), color_hex: normalizedColor } : entry))
      );
      notifyStatus("success", "Status group color saved.");
    } catch (error) {
      console.error("Failed to update status group color:", error);
      notifyStatus("danger", "Failed to update status group color.");
    } finally {
      setSavingGroupColorId(null);
    }
  };

  const beginStatusRename = (status) => {
    setEditingStatusId(status.id);
    setEditingStatusLabel(status.label || "");
  };

  const cancelStatusRename = () => {
    setEditingStatusId(null);
    setEditingStatusLabel("");
  };

  const handleStatusSave = async (status, patch = {}) => {
    if (!workspace?.id || !status?.id) return;
    const nextLabel = String((patch.label ?? editingStatusLabel ?? status.label) || "").trim();
    const nextGroupKey = patch.group_key || status.group_key;
    if (!nextLabel) {
      notifyStatus("danger", "Status label is required.");
      return;
    }

    setSavingStatusId(status.id);
    try {
      const { data } = await base44.functions.invoke(
        "upsertItemStatus",
        {
          workspace_id: workspace.id,
          status_id: status.id,
          group_key: nextGroupKey,
          label: nextLabel,
          display_order: Number.isNaN(Number(patch.display_order)) ? status.display_order || 0 : Number(patch.display_order),
          is_active: status.is_active !== false,
        },
        { authMode: "user" }
      );

      if (data) {
        setStatuses((prev) => prev.map((entry) => (entry.id === status.id ? data : entry)).sort(byDisplayOrder));
      } else {
        await loadStatusConfig(workspace.id);
      }
      if (editingStatusId === status.id) {
        cancelStatusRename();
      }
      notifyStatus("success", "Status saved.");
    } catch (error) {
      console.error("Failed to update status:", error);
      notifyStatus("danger", "Failed to update status.");
    } finally {
      setSavingStatusId(null);
    }
  };

  const handleAddStatus = async () => {
    if (!workspace?.id || !addStatusGroupKey) return;
    const label = String(newStatusLabel || "").trim();
    if (!label) {
      notifyStatus("danger", "Status name is required.");
      return;
    }
    const groupKey = addStatusGroupKey;
    const groupStatuses = groupedStatuses[groupKey] || [];
    try {
      setCreatingStatus(true);
      const { data } = await base44.functions.invoke(
        "upsertItemStatus",
        {
          workspace_id: workspace.id,
          group_key: groupKey,
          label,
          display_order: groupStatuses.length,
          is_active: true,
        },
        { authMode: "user" }
      );
      if (data) {
        setStatuses((prev) => [...prev, data].sort(byDisplayOrder));
      } else {
        await loadStatusConfig(workspace.id);
      }
      setShowAddStatusDialog(false);
      setNewStatusLabel("");
      setAddStatusGroupKey("");
      notifyStatus("success", "Status added.");
    } catch (error) {
      console.error("Failed to add status:", error);
      notifyStatus("danger", "Failed to add status.");
    } finally {
      setCreatingStatus(false);
    }
  };

  const handleDeleteStatus = async (statusRecord) => {
    if (!workspace?.id || !statusRecord?.id) return;
    const statusesInGroup = groupedStatuses[statusRecord.group_key] || [];
    if (statusesInGroup.length <= 1) {
      notifyStatus("danger", "Each status group must keep at least one status.");
      return;
    }

    try {
      setDeletingStatusId(statusRecord.id);
      await base44.functions.invoke(
        "deleteItemStatus",
        {
          workspace_id: workspace.id,
          status_id: statusRecord.id,
        },
        { authMode: "user" }
      );
      setStatuses((prev) => prev.filter((status) => status.id !== statusRecord.id));
      setStatusPendingDelete(null);
      notifyStatus("success", "Status removed.");
    } catch (error) {
      console.error("Failed to delete status:", error);
      notifyStatus("danger", "Failed to remove status.");
    } finally {
      setDeletingStatusId(null);
    }
  };

  const buildOptimisticStatusOrder = (statusRows, { statusId, targetGroupKey, targetIndex }) => {
    const movedStatus = statusRows.find((row) => row.id === statusId);
    if (!movedStatus) return statusRows;

    const grouped = {};
    const orderedGroupKeys = [...ITEM_GROUP_KEYS];

    statusRows.forEach((row) => {
      if (!orderedGroupKeys.includes(row.group_key)) {
        orderedGroupKeys.push(row.group_key);
      }
      if (!grouped[row.group_key]) {
        grouped[row.group_key] = [];
      }
      if (row.id !== statusId) {
        grouped[row.group_key].push({ ...row });
      }
    });

    Object.keys(grouped).forEach((groupKey) => {
      grouped[groupKey].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    });

    if (!grouped[targetGroupKey]) {
      grouped[targetGroupKey] = [];
      if (!orderedGroupKeys.includes(targetGroupKey)) {
        orderedGroupKeys.push(targetGroupKey);
      }
    }

    const targetList = grouped[targetGroupKey];
    const boundedIndex = Math.max(0, Math.min(Number(targetIndex) || 0, targetList.length));
    targetList.splice(boundedIndex, 0, { ...movedStatus, group_key: targetGroupKey });

    const next = [];
    orderedGroupKeys.forEach((groupKey) => {
      const rows = grouped[groupKey] || [];
      rows.forEach((row, index) => {
        next.push({
          ...row,
          display_order: index,
        });
      });
    });
    return next;
  };

  const applyStatusReorder = async ({ statusId, targetGroupKey, targetIndex, reassignmentStatusId }) => {
    if (!workspace?.id) return;
    let previousStatusesSnapshot = null;
    try {
      setSavingStatusMove(true);
      setStatuses((prev) => {
        previousStatusesSnapshot = prev;
        return buildOptimisticStatusOrder(prev, { statusId, targetGroupKey, targetIndex });
      });
      const { data } = await base44.functions.invoke(
        "reorderItemStatuses",
        {
          workspace_id: workspace.id,
          status_id: statusId,
          target_group_key: targetGroupKey,
          target_index: targetIndex,
          reassignment_status_id: reassignmentStatusId || null,
        },
        { authMode: "user" }
      );
      if (data?.statuses) {
        setStatuses(data.statuses || []);
      } else {
        await loadStatusConfig(workspace.id);
      }
      notifyStatus("success", "Status ordering updated.");
    } catch (error) {
      console.error("Failed to reorder status:", error);
      if (previousStatusesSnapshot) {
        setStatuses(previousStatusesSnapshot);
      }
      notifyStatus("danger", "Failed to reorder status.");
    } finally {
      setSavingStatusMove(false);
    }
  };

  const handleStatusDragEnd = (result) => {
    if (!workspace?.id) return;
    if (!result?.destination) return;
    const sourceGroupKey = result.source.droppableId;
    const destinationGroupKey = result.destination.droppableId;
    const sourceGroupStatuses = groupedStatuses[sourceGroupKey] || [];
    const movedStatus = sourceGroupStatuses[result.source.index];
    if (!movedStatus) return;

    if (sourceGroupKey === destinationGroupKey && result.source.index === result.destination.index) {
      return;
    }

    if (sourceGroupKey !== destinationGroupKey) {
      setStatusMovePending({
        status: movedStatus,
        sourceGroupKey,
        destinationGroupKey,
        destinationIndex: result.destination.index,
      });
      setStatusMoveTargetId("");
      return;
    }

    void applyStatusReorder({
      statusId: movedStatus.id,
      targetGroupKey: destinationGroupKey,
      targetIndex: result.destination.index,
      reassignmentStatusId: null,
    });
  };

  const confirmStatusCrossGroupMove = async () => {
    if (!statusMovePending) return;
    if (!statusMoveTargetId) {
      notifyStatus("danger", "Choose a destination status for existing items.");
      return;
    }

    const pendingMove = statusMovePending;
    const pendingTargetStatus = statusMoveTargetId;
    setStatusMovePending(null);
    setStatusMoveTargetId("");

    await applyStatusReorder({
      statusId: pendingMove.status.id,
      targetGroupKey: pendingMove.destinationGroupKey,
      targetIndex: pendingMove.destinationIndex,
      reassignmentStatusId: pendingTargetStatus,
    });
  };

  const moveItemType = async (itemTypeId, direction) => {
    if (!workspace?.id) return;
    const ordered = itemTypes.slice().sort(byDisplayOrder);
    const currentIndex = ordered.findIndex((row) => row.id === itemTypeId);
    if (currentIndex < 0) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;

    const next = ordered.slice();
    const [moved] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moved);
    const orderedIds = next.map((row) => row.id);

    try {
      setReorderingItemTypeId(itemTypeId);
      const { data } = await base44.functions.invoke(
        "reorderItemTypes",
        { workspace_id: workspace.id, ordered_type_ids: orderedIds },
        { authMode: "user" }
      );
      setItemTypes((data?.item_types || []).sort(byDisplayOrder));
    } catch (error) {
      console.error("Failed to reorder item types:", error);
      notifyStatus("danger", "Failed to reorder item types.");
    } finally {
      setReorderingItemTypeId(null);
    }
  };

  const saveItemType = async (itemType = null) => {
    if (!workspace?.id) return;
    const label = String(editingItemTypeLabel || "").trim();
    if (!label) {
      notifyStatus("danger", "Type label is required.");
      return;
    }

    setSavingItemType(true);
    try {
      const { data } = await base44.functions.invoke(
        "upsertItemType",
        {
          workspace_id: workspace.id,
          item_type_id: itemType?.id || null,
          label,
          is_active: true,
          display_order: itemType?.display_order ?? itemTypes.length,
        },
        { authMode: "user" }
      );

      if (itemType?.id) {
        setItemTypes((prev) => prev.map((row) => (row.id === itemType.id ? data : row)).sort(byDisplayOrder));
      } else {
        setItemTypes((prev) => [...prev, data].sort(byDisplayOrder));
      }
      setEditingItemTypeId(null);
      setEditingItemTypeLabel("");
      notifyStatus("success", "Item type saved.");
    } catch (error) {
      console.error("Failed to save item type:", error);
      notifyStatus("danger", "Failed to save item type.");
    } finally {
      setSavingItemType(false);
    }
  };

  const removeItemType = async (itemType) => {
    if (!workspace?.id || !itemType?.id) return;
    const replacement = itemTypes
      .filter((row) => row.id !== itemType.id && row.is_active !== false)
      .sort(byDisplayOrder)[0];
    if (!replacement) {
      notifyStatus("danger", "Each workspace must keep at least one item type.");
      return;
    }

    try {
      setDeletingItemTypeId(itemType.id);
      await base44.functions.invoke(
        "deleteItemType",
        {
          workspace_id: workspace.id,
          item_type_id: itemType.id,
          replacement_item_type_id: replacement.id,
        },
        { authMode: "user" }
      );
      setItemTypes((prev) => prev.filter((row) => row.id !== itemType.id));
      notifyStatus("success", "Item type removed.");
    } catch (error) {
      console.error("Failed to remove item type:", error);
      notifyStatus("danger", "Failed to remove item type.");
    } finally {
      setDeletingItemTypeId(null);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace) return;
    setDeletingWorkspace(true);
    try {
      await base44.functions.invoke(
        "archiveWorkspace",
        { workspace_id: workspace.id },
        { authMode: "user" }
      );
      sessionStorage.clear();
      navigate(createPageUrl("Workspaces"));
    } catch (error) {
      console.error("Failed to archive workspace:", error);
      const status = getErrorStatus(error);
      if (status === 403) {
        notifyStatus("danger", "Only the workspace owner can delete this workspace.");
      } else {
        notifyStatus("danger", "Failed to delete workspace.");
      }
    } finally {
      setDeletingWorkspace(false);
      setShowDeleteWorkspaceDialog(false);
    }
  };

  const isAdmin = isAdminRole(role);
  const isOwner = isOwnerRole(role);

  if (loading) {
    return <PageLoadingState text="Loading settings..." />;
  }

  if (initialLoadError) {
    return (
      <PageShell className="mx-auto max-w-5xl">
        <PageHeader
          title={isAdmin ? "Workspace Settings" : "Settings"}
          description={
            isAdmin
              ? "Configure your workspace and manage access."
              : "Manage your account information."
          }
        />
        <StatePanel
          tone="danger"
          title="Settings unavailable"
          description={initialLoadError}
          action={() => {
            if (workspace?.id) {
              void loadAll(workspace.id);
            }
          }}
          actionLabel="Retry"
        />
      </PageShell>
    );
  }

  if (!isAdmin) {
    return (
      <PageShell className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Settings"
          description="You can edit your account profile details from this page."
        />

        <AccountSettingsPanel
          onStatusChange={(nextStatus) => {
            if (!nextStatus?.message) return;
            notifyStatus(nextStatus.tone, nextStatus.message);
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Workspace Settings"
        description="Manage your account, workspace policies, and item status configuration."
        actions={
          isOwner ? (
            <Button onClick={() => void handleOpenBilling()} disabled={openingBilling}>
              {openingBilling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              {openingBilling ? "Opening Stripe..." : "Billing"}
            </Button>
          ) : null
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="my-account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            My Account
          </TabsTrigger>
          {isAdmin ? (
            <>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="access" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Access
          </TabsTrigger>
          <TabsTrigger value="status-groups" className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            Status Groups
          </TabsTrigger>
          <TabsTrigger value="item-types" className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            Item Types
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Access
          </TabsTrigger>
            </>
          ) : null}
        </TabsList>

        <TabsContent value="my-account" className="space-y-6">
          <AccountSettingsPanel
            onStatusChange={(nextStatus) => {
              if (!nextStatus?.message) return;
              notifyStatus(nextStatus.tone, nextStatus.message);
            }}
          />
        </TabsContent>

        {isAdmin ? (
          <>
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Update your workspace details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Workspace Name</Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1.5 max-w-md"
                  disabled={!isOwner}
                />
                {!isOwner ? (
                  <p className="mt-1 text-xs text-slate-500">Only the workspace owner can rename the workspace.</p>
                ) : null}
              </div>

              <div>
                <Label>Workspace Slug</Label>
                <Input
                  value={slug}
                  onChange={(event) => {
                    setSlug(event.target.value.toLowerCase());
                    setSlugError("");
                  }}
                  className="mt-1.5 max-w-md font-mono"
                  disabled={!isOwner}
                />
                {slugError ? <p className="mt-1 text-xs text-rose-600">{slugError}</p> : null}
                {!isOwner ? (
                  <p className="mt-1 text-xs text-slate-500">Only the workspace owner can change the workspace slug.</p>
                ) : null}
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1.5 max-w-xl"
                />
              </div>

              <div>
                <Label>Workspace Logo</Label>
                <div className="mt-1.5 flex items-center gap-4">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Workspace logo"
                      className="h-12 w-12 rounded-lg border border-slate-200 object-contain"
                    />
                  ) : null}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        {uploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {uploadingLogo ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}
                      </span>
                    </Button>
                  </label>
                  {logoUrl ? (
                    <Button variant="ghost" size="sm" onClick={() => setLogoUrl("")}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              <div>
                <Label>Primary Brand Color</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                    className="h-10 w-20 cursor-pointer rounded border border-slate-200"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                    className="max-w-32 font-mono"
                  />
                </div>
              </div>

              <div>
                <Label>Public Workspace URL</Label>
                <div className="mt-1.5 flex max-w-xl gap-2">
                  <Input
                    value={`${window.location.origin}${workspace?.slug ? workspaceUrl(workspace.slug, "feedback") : ""}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyUrl}>
                    {copiedUrl ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workspace Behavior</CardTitle>
              <CardDescription>Configure contribution settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex max-w-md items-center justify-between">
                <div>
                  <Label>File Attachments</Label>
                  <p className="text-sm text-slate-500">Allow uploads on item submissions.</p>
                </div>
                <Switch
                  checked={settings.allow_attachments !== false}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, allow_attachments: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteWorkspaceDialog(true)}
              disabled={!isOwner}
              title={!isOwner ? "Only the workspace owner can delete this workspace." : undefined}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Workspace
            </Button>
            <Button onClick={handleSaveSettings} disabled={saving} className="bg-slate-900 hover:bg-slate-800">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Access Settings</CardTitle>
              <CardDescription>
                Configure workspace visibility and private access controls.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex max-w-md items-center justify-between">
                <div>
                  <Label>Workspace Visibility</Label>
                  <p className="text-sm text-slate-500">Choose whether this workspace is public or private.</p>
                </div>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="restricted">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {visibility === "restricted" ? (
                <>
                  <div className="flex max-w-xl items-center gap-2">
                    <Input
                      value={accessCodeStatus.accessCode || accessCodeStatus.maskedCode || "••••••••••"}
                      readOnly
                      className="font-mono text-center uppercase tracking-[0.22em]"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        void handleToggleRevealAccessCode();
                      }}
                      disabled={loadingAccessCode}
                      aria-label={accessCodeStatus.accessCode ? "Hide workspace code" : "Reveal workspace code"}
                      title={accessCodeStatus.accessCode ? "Hide workspace code" : "Reveal workspace code"}
                    >
                      {loadingAccessCode ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : accessCodeStatus.accessCode ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyAccessCode}
                      aria-label="Copy workspace code"
                      title="Copy workspace code"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRotateAccessCodeDialog(true)}
                      disabled={!isOwner || rotatingAccessCode}
                      title={!isOwner ? "Only owners can rotate workspace code." : undefined}
                    >
                      {rotatingAccessCode ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      {rotatingAccessCode ? "Rotating..." : "Rotate"}
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500">
                    {accessCodeStatus.createdAt ? (
                      <>
                        Last rotated <RelativeDate value={accessCodeStatus.createdAt} />
                      </>
                    ) : (
                      "Code rotation history is unavailable."
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  This workspace is public. Anyone with the workspace URL can view it.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>Manage workspace member roles.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 max-w-sm">
                <Label htmlFor="member-search">Search users</Label>
                <Input
                  id="member-search"
                  value={memberSearchQuery}
                  onChange={(event) => setMemberSearchQuery(event.target.value)}
                  className="mt-1.5"
                  placeholder="Search by name or email"
                />
              </div>

              {members.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">No users yet.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-sm text-slate-500">
                            No users match this search.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMembers.map((member) => {
                          const isOwnerMember = member.role === "owner";
                          const canEditRole = isOwner || !isOwnerMember;
                          const canRemoveMember =
                            (isOwner || !isOwnerMember) &&
                            !(isOwnerMember && ownerCount <= 1);
                          return (
                            <TableRow key={member.id}>
                              <TableCell>{getMemberDisplayName(member)}</TableCell>
                              <TableCell>{member.email}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={member.role}
                                    onValueChange={(value) => handleUpdateMemberRole(member.id, value)}
                                  >
                                    <SelectTrigger
                                      className="w-40"
                                      disabled={!canEditRole || updatingMemberId === member.id}
                                      title={!canEditRole ? "Only owners can modify owner roles." : undefined}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="contributor">Contributor</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="owner" disabled={!isOwner}>
                                        Owner
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {updatingMemberId === member.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  onClick={() => setMemberPendingRemoval(member)}
                                  disabled={!canRemoveMember || updatingMemberId === member.id}
                                  title={
                                    !canRemoveMember
                                      ? "Only owners can remove owner memberships."
                                      : isOwnerMember && ownerCount <= 1
                                        ? "Add another owner before removing the last owner."
                                        : undefined
                                  }
                                >
                                  {updatingMemberId === member.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving} className="bg-slate-900 hover:bg-slate-800">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="status-groups" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status Groups</CardTitle>
              <CardDescription>
                Manage status labels and ordering for Feedback, Roadmap, and Changelog. Drag statuses to reorder or move across groups.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {savingStatusMove ? (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving status order...
                </div>
              ) : null}
              <DragDropContext onDragEnd={handleStatusDragEnd}>
                {[...statusGroups].sort(byDisplayOrder).map((group) => {
                  const groupStatuses = groupedStatuses[group.group_key] || [];
                  const draftColor = statusDrafts[group.id]?.color_hex ?? group.color_hex ?? "#0F172A";
                  const normalizedDraftColor = String(draftColor || "").trim().toUpperCase();
                  const normalizedGroupColor = String(group.color_hex || "").trim().toUpperCase();
                  const hasColorChanged = normalizedDraftColor !== normalizedGroupColor;
                  const isSavingGroupColor = savingGroupColorId === group.id;

                  return (
                    <div key={group.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-h-9 flex items-center">
                          <p className="text-sm font-semibold text-slate-900 leading-none">
                            {ITEM_GROUP_LABELS[group.group_key] || group.display_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 self-start md:self-auto">
                          <Input
                            value={draftColor}
                            onChange={(event) =>
                              setStatusDrafts((prev) => ({
                                ...prev,
                                [group.id]: {
                                  ...(prev[group.id] || {}),
                                  color_hex: event.target.value.toUpperCase(),
                                },
                              }))
                            }
                            className="w-32 font-mono text-xs uppercase"
                          />
                          <input
                            type="color"
                            value={draftColor}
                            onChange={(event) =>
                              setStatusDrafts((prev) => ({
                                ...prev,
                                [group.id]: {
                                  ...(prev[group.id] || {}),
                                  color_hex: event.target.value.toUpperCase(),
                                },
                              }))
                            }
                            className="h-9 w-10 cursor-pointer rounded border border-slate-200 p-0"
                          />
                          {hasColorChanged ? (
                            <Button
                              variant="outline"
                              onClick={() => {
                                void handleGroupColorSave(group, draftColor);
                              }}
                              disabled={isSavingGroupColor}
                            >
                              {isSavingGroupColor ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                "Save Color"
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <Droppable droppableId={group.group_key}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2"
                          >
                            {groupStatuses.map((status, index) => (
                              <Draggable key={status.id} draggableId={status.id} index={index} isDragDisabled={savingStatusMove}>
                                {(dragProvided, snapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    className={cn(
                                      "flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3",
                                      snapshot.isDragging && "border-slate-300 shadow-md"
                                    )}
                                  >
                                    <button
                                      type="button"
                                      className="text-slate-400"
                                      {...dragProvided.dragHandleProps}
                                      aria-label="Drag status"
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </button>

                                    <div className="flex-1">
                                      {editingStatusId === status.id ? (
                                        <Input
                                          value={editingStatusLabel}
                                          onChange={(event) => setEditingStatusLabel(event.target.value)}
                                          className="h-8"
                                        />
                                      ) : (
                                        <p className="text-sm font-medium text-slate-900">{status.label}</p>
                                      )}
                                    </div>

                                    {editingStatusId === status.id ? (
                                      <div className="flex items-center gap-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={savingStatusId === status.id}
                                          onClick={() => {
                                            void handleStatusSave(status, { label: editingStatusLabel });
                                          }}
                                        >
                                          {savingStatusId === status.id ? (
                                            <>
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              Saving...
                                            </>
                                          ) : (
                                            "Save"
                                          )}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={cancelStatusRename}
                                          disabled={savingStatusId === status.id}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => beginStatusRename(status)}
                                          aria-label="Edit status"
                                          disabled={Boolean(savingStatusId) || deletingStatusId === status.id}
                                        >
                                          <Pencil className="h-4 w-4 text-slate-500" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                          onClick={() => setStatusPendingDelete(status)}
                                          aria-label="Delete status"
                                          disabled={deletingStatusId === status.id || groupStatuses.length <= 1}
                                          title={
                                            groupStatuses.length <= 1
                                              ? "Each status group must keep at least one status."
                                              : undefined
                                          }
                                        >
                                          {deletingStatusId === status.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>

                      <div className="mt-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setAddStatusGroupKey(group.group_key);
                            setNewStatusLabel("");
                            setShowAddStatusDialog(true);
                          }}
                          disabled={creatingStatus}
                        >
                          {creatingStatus && addStatusGroupKey === group.group_key ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          {creatingStatus && addStatusGroupKey === group.group_key ? "Adding..." : "Add Status"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </DragDropContext>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="item-types" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Item Types</CardTitle>
              <CardDescription>
                Manage global item types used across Feedback, Roadmap, and Changelog.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {itemTypes.sort(byDisplayOrder).map((itemType, index) => (
                <div key={itemType.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        void moveItemType(itemType.id, "up");
                      }}
                      disabled={index === 0 || Boolean(reorderingItemTypeId)}
                    >
                      {reorderingItemTypeId === itemType.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "↑"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        void moveItemType(itemType.id, "down");
                      }}
                      disabled={index === itemTypes.length - 1 || Boolean(reorderingItemTypeId)}
                    >
                      {reorderingItemTypeId === itemType.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "↓"}
                    </Button>
                  </div>

                  <div className="flex-1">
                    {editingItemTypeId === itemType.id ? (
                      <Input
                        value={editingItemTypeLabel}
                        onChange={(event) => setEditingItemTypeLabel(event.target.value)}
                        className="h-8"
                      />
                    ) : (
                      <p className="text-sm font-medium text-slate-900">{itemType.label}</p>
                    )}
                  </div>

                  {editingItemTypeId === itemType.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingItemType}
                        onClick={() => {
                          void saveItemType(itemType);
                        }}
                      >
                        {savingItemType ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingItemTypeId(null);
                          setEditingItemTypeLabel("");
                        }}
                        disabled={savingItemType}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingItemTypeId(itemType.id);
                          setEditingItemTypeLabel(itemType.label || "");
                        }}
                        disabled={savingItemType || Boolean(reorderingItemTypeId) || deletingItemTypeId === itemType.id}
                      >
                        <Pencil className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => {
                          void removeItemType(itemType);
                        }}
                        disabled={deletingItemTypeId === itemType.id}
                      >
                        {deletingItemTypeId === itemType.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={editingItemTypeId ? "" : editingItemTypeLabel}
                  onChange={(event) => {
                    setEditingItemTypeId(null);
                    setEditingItemTypeLabel(event.target.value);
                  }}
                  placeholder="New type label"
                  className="max-w-sm"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    void saveItemType(null);
                  }}
                  disabled={savingItemType}
                >
                  {savingItemType ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {savingItemType ? "Saving..." : "Add Type"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <WorkspaceApiPanel workspace={workspace} role={role} />
        </TabsContent>
          </>
        ) : null}
      </Tabs>

      {isAdmin ? (
        <>
      <ConfirmDialog
        open={showDeleteWorkspaceDialog}
        onOpenChange={setShowDeleteWorkspaceDialog}
        title="Delete Workspace"
        description="This archives the workspace and removes access for everyone. This action cannot be undone."
        confirmLabel={deletingWorkspace ? "Deleting..." : "Delete Workspace"}
        onConfirm={handleDeleteWorkspace}
        loading={deletingWorkspace}
        confirmClassName="bg-rose-600 hover:bg-rose-700"
      />

      <ConfirmDialog
        open={Boolean(memberPendingRemoval)}
        onOpenChange={(open) => {
          if (!open) {
            setMemberPendingRemoval(null);
          }
        }}
        title="Remove Member Access"
        description={
          memberPendingRemoval
            ? memberPendingRemoval.role === "owner"
              ? ownerCount <= 1
                ? "This member is the last owner. Add another owner before removing owner access."
                : `Remove owner access for ${memberPendingRemoval.email}?`
              : `Remove access for ${memberPendingRemoval.email}? They can be invited again later.`
            : ""
        }
        confirmLabel={updatingMemberId === memberPendingRemoval?.id ? "Removing..." : "Remove Member"}
        onConfirm={handleRemoveMember}
        loading={updatingMemberId === memberPendingRemoval?.id}
        confirmClassName="bg-rose-600 hover:bg-rose-700"
      />

      <Dialog open={showRotateAccessCodeDialog} onOpenChange={setShowRotateAccessCodeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rotate Workspace Code</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Rotating the workspace code invalidates the previous code immediately. People with the old code will no longer be able to join.
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowRotateAccessCodeDialog(false)}
              disabled={rotatingAccessCode}
            >
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                void handleRotateAccessCode();
              }}
              disabled={rotatingAccessCode}
            >
              {rotatingAccessCode ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rotating...
                </>
              ) : (
                "Rotate Code"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(statusMovePending)}
        onOpenChange={(open) => {
          if (!open) {
            setStatusMovePending(null);
            setStatusMoveTargetId("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Status Move</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              You are moving{" "}
              <span className="font-semibold text-slate-900">
                {statusMovePending?.status?.label || "this status"}
              </span>{" "}
              from{" "}
              <span className="font-semibold text-slate-900">
                {ITEM_GROUP_LABELS[statusMovePending?.sourceGroupKey] || statusMovePending?.sourceGroupKey}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-900">
                {ITEM_GROUP_LABELS[statusMovePending?.destinationGroupKey] || statusMovePending?.destinationGroupKey}
              </span>
              . Choose the fallback status for items currently using this status.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="status-move-target">Reassign existing items to</Label>
              <Select value={statusMoveTargetId} onValueChange={setStatusMoveTargetId}>
                <SelectTrigger id="status-move-target">
                  <SelectValue placeholder="Select destination status" />
                </SelectTrigger>
                <SelectContent>
                  {statusMoveTargetOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.groupLabel} • {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStatusMovePending(null);
                setStatusMoveTargetId("");
              }}
              disabled={savingStatusMove}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                void confirmStatusCrossGroupMove();
              }}
              disabled={savingStatusMove || !statusMoveTargetId}
            >
              {savingStatusMove ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Moving...
                </>
              ) : (
                "Move Status"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAddStatusDialog}
        onOpenChange={(open) => {
          setShowAddStatusDialog(open);
          if (!open) {
            setNewStatusLabel("");
            setAddStatusGroupKey("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-status-label">Status name</Label>
            <Input
              id="new-status-label"
              value={newStatusLabel}
              onChange={(event) => setNewStatusLabel(event.target.value)}
              placeholder="Enter status name"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddStatusDialog(false);
                setNewStatusLabel("");
                setAddStatusGroupKey("");
              }}
              disabled={creatingStatus}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleAddStatus();
              }}
              disabled={creatingStatus}
            >
              {creatingStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Status"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(statusPendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setStatusPendingDelete(null);
          }
        }}
        title="Delete Status"
        description={
          statusPendingDelete
            ? `Delete "${statusPendingDelete.label}"? Items using this status may need reassignment first.`
            : ""
        }
        confirmLabel={
          deletingStatusId === statusPendingDelete?.id ? "Deleting..." : "Delete Status"
        }
        onConfirm={() => {
          if (statusPendingDelete) {
            void handleDeleteStatus(statusPendingDelete);
          }
        }}
        loading={deletingStatusId === statusPendingDelete?.id}
        confirmClassName="bg-rose-600 hover:bg-rose-700"
      />
        </>
      ) : null}
    </PageShell>
  );
}
