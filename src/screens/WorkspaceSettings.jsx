"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@/lib/router";
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
} from "lucide-react";
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
import { getWorkspaceSession, setWorkspaceSession } from "@/lib/workspace-session";
import { workspaceDefaultUrl, workspaceUrl } from "@/components/utils/workspaceUrl";
import AccountSettingsPanel from "@/components/workspace/AccountSettingsPanel";
import WorkspaceApiPanel from "@/components/workspace/WorkspaceApiPanel";
import WorkspaceBillingPanel from "@/components/workspace/WorkspaceBillingPanel";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_GROUP_STATUSES,
  ITEM_GROUP_KEYS,
  ITEM_GROUP_LABELS,
  sanitizeStatusKey,
} from "@/lib/item-groups";
import { isAdminRole, isOwnerRole } from "@/lib/roles";

const SETTINGS_TABS = ["my-account", "general", "access", "status-groups", "billing", "api"];

function byDisplayOrder(a, b) {
  return (a.display_order || 0) - (b.display_order || 0);
}

function getErrorStatus(error) {
  if (!error) return null;
  return error.status ?? error.context?.status ?? error.response?.status ?? null;
}

export default function WorkspaceSettings() {
  const navigate = useNavigate();
  const location = useLocation();

  const [workspace, setWorkspace] = useState(null);
  const [role, setRole] = useState("contributor");
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
  const [savingStatusId, setSavingStatusId] = useState(null);
  const [showDeleteWorkspaceDialog, setShowDeleteWorkspaceDialog] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [activeTab, setActiveTab] = useState("my-account");
  const { toast } = useToast();

  const notifyStatus = (tone, message) => {
    if (!message) return;
    toast({
      title: tone === "danger" ? "Action failed" : "Success",
      description: message,
      variant: tone === "danger" ? "destructive" : "default",
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

    setRole(resolvedRole);
    setActiveTab(adminRole ? "general" : "my-account");
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
      return;
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const requestedTab = params.get("tab");
    if (!requestedTab || !SETTINGS_TABS.includes(requestedTab)) {
      return;
    }
    const requiresAdmin = requestedTab !== "my-account";
    const requiresOwner = requestedTab === "billing";
    if ((requiresAdmin && !isAdminRole(role)) || (requiresOwner && !isOwnerRole(role))) {
      setActiveTab("my-account");
      params.delete("tab");
      const search = params.toString();
      navigate(`${createPageUrl("WorkspaceSettings")}${search ? `?${search}` : ""}`, {
        replace: true,
      });
      return;
    }
    setActiveTab(requestedTab);
  }, [location.search, role, navigate]);

  const handleTabChange = (nextTab) => {
    if ((!isAdminRole(role) && nextTab !== "my-account") || (nextTab === "billing" && !isOwnerRole(role))) {
      return;
    }
    setActiveTab(nextTab);

    const params = new URLSearchParams(location.search || "");
    const defaultTab = isAdminRole(role) ? "general" : "my-account";
    if (nextTab === defaultTab) {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }
    const search = params.toString();
    const nextUrl = `${createPageUrl("WorkspaceSettings")}${search ? `?${search}` : ""}`;
    navigate(nextUrl, { replace: true });
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

      await ensureStatusConfig(workspaceId);
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

  const ensureStatusConfig = async (workspaceId) => {
    const [groupRows, statusRows] = await Promise.all([
      base44.entities.ItemStatusGroup.filter({ workspace_id: workspaceId }, "display_order"),
      base44.entities.ItemStatus.filter({ workspace_id: workspaceId }, "display_order"),
    ]);

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
        display_order: index,
      });
      createdGroups.push(group);

      for (const [statusIndex, status] of (DEFAULT_GROUP_STATUSES[groupKey] || []).entries()) {
        const created = await base44.entities.ItemStatus.create({
          workspace_id: workspaceId,
          group_key: groupKey,
          status_key: status.key,
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

  const handleGroupNameSave = async (groupId, nextName) => {
    const trimmed = nextName.trim();
    if (!trimmed) {
      notifyStatus("danger", "Group name cannot be empty.");
      return;
    }
    try {
      const updated = await base44.entities.ItemStatusGroup.update(groupId, {
        display_name: trimmed,
      });
      setStatusGroups((prev) => prev.map((group) => (group.id === groupId ? updated : group)));
      notifyStatus("success", "Status group name saved.");
    } catch (error) {
      console.error("Failed to update status group:", error);
      notifyStatus("danger", "Failed to update status group name.");
    }
  };

  const handleStatusSave = async (statusId, patch) => {
    const nextLabel = patch.label?.trim();
    const nextKey = sanitizeStatusKey(patch.status_key || patch.key);
    const groupKey = patch.group_key;

    if (!nextLabel) {
      notifyStatus("danger", "Status label is required.");
      return;
    }
    if (!nextKey) {
      notifyStatus("danger", "Status key is required.");
      return;
    }

    const duplicate = statuses.find(
      (status) =>
        status.id !== statusId &&
        status.group_key === groupKey &&
        status.status_key === nextKey
    );
    if (duplicate) {
      notifyStatus("danger", "Status key must be unique within each group.");
      return;
    }

    setSavingStatusId(statusId);
    try {
      const updated = await base44.entities.ItemStatus.update(statusId, {
        label: nextLabel,
        status_key: nextKey,
      });
      setStatuses((prev) => prev.map((status) => (status.id === statusId ? updated : status)));
      notifyStatus("success", "Status saved.");
    } catch (error) {
      console.error("Failed to update status:", error);
      notifyStatus("danger", "Failed to update status.");
    } finally {
      setSavingStatusId(null);
    }
  };

  const handleAddStatus = async (groupKey) => {
    if (!workspace?.id) return;
    const groupStatuses = groupedStatuses[groupKey] || [];
    const defaultKey = sanitizeStatusKey(`new_status_${groupStatuses.length + 1}`);

    const duplicate = groupStatuses.some((status) => status.status_key === defaultKey);
    const resolvedKey = duplicate ? `${defaultKey}_${Date.now().toString().slice(-4)}` : defaultKey;

    try {
      const created = await base44.entities.ItemStatus.create({
        workspace_id: workspace.id,
        group_key: groupKey,
        status_key: resolvedKey,
        label: "New Status",
        display_order: groupStatuses.length,
        is_active: true,
      });
      setStatuses((prev) => [...prev, created].sort(byDisplayOrder));
      notifyStatus("success", "Status added.");
    } catch (error) {
      console.error("Failed to add status:", error);
      notifyStatus("danger", "Failed to add status.");
    }
  };

  const handleDeleteStatus = async (statusRecord) => {
    const groupStatuses = groupedStatuses[statusRecord.group_key] || [];
    if (groupStatuses.length <= 1) {
      notifyStatus("danger", "Each group must keep at least one status.");
      return;
    }

    try {
      await base44.entities.ItemStatus.delete(statusRecord.id);
      setStatuses((prev) => prev.filter((status) => status.id !== statusRecord.id));
      notifyStatus("success", "Status removed.");
    } catch (error) {
      console.error("Failed to delete status:", error);
      notifyStatus("danger", "Failed to remove status.");
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
          title="Workspace Settings"
          description="Configure your workspace and manage access."
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

  return (
    <PageShell className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Workspace Settings"
        description="Manage your account, workspace policies, and item status configuration."
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
            Users
          </TabsTrigger>
          <TabsTrigger value="status-groups" className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            Status Groups
          </TabsTrigger>
          {isOwner ? (
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Billing
            </TabsTrigger>
          ) : null}
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
                      <span>{uploadingLogo ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}</span>
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
              <CardDescription>Configure visibility and contribution settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex max-w-md items-center justify-between">
                <div>
                  <Label>Visibility</Label>
                  <p className="text-sm text-slate-500">Who can view this workspace.</p>
                </div>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Code</CardTitle>
              <CardDescription>
                This code is always active for restricted workspace access. Rotating it invalidates the previous code immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  {accessCodeStatus.accessCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Rotate
                </Button>
              </div>
              <div className="text-xs text-slate-500">
                {accessCodeStatus.createdAt
                  ? `Last rotated ${new Date(accessCodeStatus.createdAt).toLocaleString()}`
                  : "Code rotation history is unavailable."}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
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
                                  <Trash2 className="h-4 w-4" />
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
        </TabsContent>

        <TabsContent value="status-groups" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status Groups</CardTitle>
              <CardDescription>
                Configure status values for Feedback, Roadmap, and Changelog. Every item must belong to one status in its group.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[...statusGroups].sort(byDisplayOrder).map((group) => {
                const groupStatuses = groupedStatuses[group.group_key] || [];
                return (
                  <div key={group.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div className="w-full md:max-w-sm">
                        <Label>{ITEM_GROUP_LABELS[group.group_key]} Group Name</Label>
                        <Input
                          value={statusDrafts[group.id]?.display_name ?? group.display_name}
                          onChange={(event) =>
                            setStatusDrafts((prev) => ({
                              ...prev,
                              [group.id]: {
                                ...(prev[group.id] || {}),
                                display_name: event.target.value,
                              },
                            }))
                          }
                          className="mt-1.5"
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleGroupNameSave(
                            group.id,
                            statusDrafts[group.id]?.display_name ?? group.display_name
                          )
                        }
                      >
                        Save Group Name
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {groupStatuses.map((status) => {
                        const draft = statusDrafts[status.id] || {};
                        const label = draft.label ?? status.label;
                        const key = draft.status_key ?? status.status_key;
                        return (
                          <div
                            key={status.id}
                            className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_1fr_auto_auto]"
                          >
                            <Input
                              value={label}
                              onChange={(event) =>
                                setStatusDrafts((prev) => ({
                                  ...prev,
                                  [status.id]: {
                                    ...(prev[status.id] || {}),
                                    label: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Status label"
                            />
                            <Input
                              value={key}
                              onChange={(event) =>
                                setStatusDrafts((prev) => ({
                                  ...prev,
                                  [status.id]: {
                                    ...(prev[status.id] || {}),
                                    status_key: sanitizeStatusKey(event.target.value),
                                  },
                                }))
                              }
                              placeholder="status_key"
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="outline"
                              disabled={savingStatusId === status.id}
                              onClick={() =>
                                handleStatusSave(status.id, {
                                  label,
                                  status_key: key,
                                  group_key: group.group_key,
                                })
                              }
                            >
                              {savingStatusId === status.id ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => handleDeleteStatus(status)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3">
                      <Button variant="outline" onClick={() => handleAddStatus(group.group_key)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Status
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {isOwner ? (
          <TabsContent value="billing">
            <WorkspaceBillingPanel workspace={workspace} />
          </TabsContent>
        ) : null}

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
              {rotatingAccessCode ? "Rotating..." : "Rotate Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      ) : null}
    </PageShell>
  );
}
