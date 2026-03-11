"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@/lib/router";
import { Settings, Users, Key, Trash2, Save, Copy, Check, Plus, User, CreditCard } from "lucide-react";
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
import Badge from "@/components/common/Badge";
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
import { getRoleLabel, isAdminRole, isOwnerRole } from "@/lib/roles";

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
  const [role, setRole] = useState("viewer");
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
  const [ownerTransferTargetMemberId, setOwnerTransferTargetMemberId] = useState("");
  const [showOwnerTransferDialog, setShowOwnerTransferDialog] = useState(false);
  const [accessCodeStatus, setAccessCodeStatus] = useState({ hasCode: false, expiresAt: null });
  const [accessCodeExpiry, setAccessCodeExpiry] = useState("7d");
  const [generatedAccessCode, setGeneratedAccessCode] = useState("");
  const [creatingAccessCode, setCreatingAccessCode] = useState(false);
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

    const resolvedRole = storedRole || "viewer";
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
    if (requestedTab !== "my-account" && !isAdminRole(role)) {
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
    if (!isAdminRole(role) && nextTab !== "my-account") {
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
    return members.filter((member) =>
      String(member.email || "").toLowerCase().includes(query)
    );
  }, [memberSearchQuery, members]);

  const ownerTransferCandidates = useMemo(() => {
    if (!memberPendingRemoval) return [];
    return members.filter((member) => member.id !== memberPendingRemoval.id);
  }, [memberPendingRemoval, members]);

  const loadAll = async (workspaceId) => {
    try {
      setInitialLoadError("");
      setLoading(true);

      const [rolesData, accessCodeData] = await Promise.all([
        loadMembers(workspaceId),
        base44.functions.invoke(
          "getWorkspaceAccessCodeStatus",
          { workspace_id: workspaceId },
          { authMode: "user" }
        ),
      ]);

      setMembers(rolesData);
      setAccessCodeStatus({
        hasCode: Boolean(accessCodeData?.data?.has_code),
        expiresAt: accessCodeData?.data?.expires_at ?? null,
      });

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
    const rolesData = await base44.entities.WorkspaceRole.filter({ workspace_id: workspaceId });
    return rolesData.sort((left, right) => {
      if (left.role === "owner" && right.role !== "owner") return -1;
      if (left.role !== "owner" && right.role === "owner") return 1;
      return String(left.email || "").localeCompare(String(right.email || ""));
    });
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
      notifyStatus("success", nextRole === "owner" ? "Ownership transferred." : "Member role updated.");
    } catch (error) {
      console.error("Failed to update member role:", error);
      const status = getErrorStatus(error);
      if (status === 409) {
        notifyStatus("danger", "Transfer ownership to another member before changing the current owner role.");
      } else {
        notifyStatus("danger", "Failed to update member role.");
      }
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberPendingRemoval) return;
    if (memberPendingRemoval.role === "owner") {
      if (!ownerTransferTargetMemberId) {
        const fallbackTarget = ownerTransferCandidates[0];
        setOwnerTransferTargetMemberId(fallbackTarget?.id || "");
      }
      setShowOwnerTransferDialog(true);
      return;
    }

    setUpdatingMemberId(memberPendingRemoval.id);
    let keepPendingRemoval = false;
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
      if (status === 409) {
        keepPendingRemoval = true;
        if (!ownerTransferTargetMemberId) {
          const fallbackTarget = ownerTransferCandidates[0];
          setOwnerTransferTargetMemberId(fallbackTarget?.id || "");
        }
        setShowOwnerTransferDialog(true);
      } else {
        notifyStatus("danger", "Failed to remove member.");
      }
    } finally {
      setUpdatingMemberId(null);
      if (!keepPendingRemoval) {
        setMemberPendingRemoval(null);
      }
    }
  };

  const handleTransferOwnershipAndRemoveMember = async () => {
    if (!workspace?.id || !memberPendingRemoval?.id || !ownerTransferTargetMemberId) return;
    setUpdatingMemberId(memberPendingRemoval.id);
    try {
      await base44.functions.invoke(
        "removeWorkspaceMember",
        {
          workspace_id: workspace.id,
          member_id: memberPendingRemoval.id,
          transfer_to_member_id: ownerTransferTargetMemberId,
        },
        { authMode: "user" }
      );
      const refreshed = await loadMembers(workspace.id);
      setMembers(refreshed);
      notifyStatus("success", "Ownership transferred and previous owner removed.");
      setShowOwnerTransferDialog(false);
      setMemberPendingRemoval(null);
      setOwnerTransferTargetMemberId("");
    } catch (error) {
      console.error("Failed to transfer ownership and remove member:", error);
      notifyStatus("danger", "Failed to transfer ownership.");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleCreateAccessCode = async () => {
    if (!workspace) return;
    setCreatingAccessCode(true);
    try {
      const { data } = await base44.functions.invoke(
        "setWorkspaceAccessCode",
        {
          workspace_id: workspace.id,
          expires_in: accessCodeExpiry,
        },
        { authMode: "user" }
      );
      setGeneratedAccessCode(data?.access_code ?? "");
      setAccessCodeStatus({
        hasCode: true,
        expiresAt: data?.expires_at ?? null,
      });
      notifyStatus("success", "Access code generated.");
    } catch (error) {
      console.error("Failed to create access code:", error);
      const status = getErrorStatus(error);
      if (status === 401) {
        notifyStatus("danger", "Your session expired. Sign in again and retry.");
      } else if (status === 403) {
        notifyStatus("danger", "Only workspace admins can generate access codes.");
      } else if (status === 404) {
        notifyStatus("danger", "Workspace not found or no longer active.");
      } else {
        notifyStatus("danger", "Failed to create access code.");
      }
    } finally {
      setCreatingAccessCode(false);
    }
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
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
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
                />
                {slugError ? <p className="mt-1 text-xs text-rose-600">{slugError}</p> : null}
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
              <CardTitle>Access Code</CardTitle>
              <CardDescription>Require a code when users join a restricted workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-600">
                    {accessCodeStatus.hasCode ? "Access code is active." : "No access code created yet."}
                  </p>
                  {accessCodeStatus.expiresAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Expires on {new Date(accessCodeStatus.expiresAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Select value={accessCodeExpiry} onValueChange={setAccessCodeExpiry}>
                    <SelectTrigger className="w-40" disabled={visibility !== "restricted"}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">24 hours</SelectItem>
                      <SelectItem value="7d">7 days</SelectItem>
                      <SelectItem value="30d">30 days</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleCreateAccessCode}
                    disabled={creatingAccessCode || visibility !== "restricted"}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    {creatingAccessCode
                      ? "Creating..."
                      : accessCodeStatus.hasCode
                        ? "Generate New Code"
                        : "Create Access Code"}
                  </Button>
                </div>
              </div>

                {generatedAccessCode ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-900">Share this access code</p>
                  <p className="mt-1 text-xs text-emerald-700">This code is shown once. Copy it now.</p>
                  <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row">
                    <Input
                      value={generatedAccessCode}
                      readOnly
                      className="font-mono text-center uppercase tracking-[0.3em]"
                    />
                    <Button variant="outline" onClick={() => navigator.clipboard.writeText(generatedAccessCode)}>
                      Copy code
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage workspace member roles.</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">No users yet.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Assigned via</TableHead>
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
                        filteredMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>{member.email}</TableCell>
                            <TableCell>
                              <Select
                                value={member.role}
                                onValueChange={(value) => handleUpdateMemberRole(member.id, value)}
                              >
                                <SelectTrigger className="w-40" disabled={updatingMemberId === member.id}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                  <SelectItem value="contributor">Contributor</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="owner">Owner</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{member.assigned_via}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                onClick={() => setMemberPendingRemoval(member)}
                                disabled={updatingMemberId === member.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <div className="mt-4 max-w-sm">
                    <Label htmlFor="member-search">Search users</Label>
                    <Input
                      id="member-search"
                      value={memberSearchQuery}
                      onChange={(event) => setMemberSearchQuery(event.target.value)}
                      className="mt-1.5"
                      placeholder="Search by email"
                    />
                  </div>
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

        <TabsContent value="billing">
          <WorkspaceBillingPanel workspace={workspace} />
        </TabsContent>

        <TabsContent value="api">
          <WorkspaceApiPanel workspace={workspace} />
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
        open={Boolean(memberPendingRemoval) && !showOwnerTransferDialog}
        onOpenChange={(open) => {
          if (!open) {
            setMemberPendingRemoval(null);
          }
        }}
        title="Remove Member Access"
        description={
          memberPendingRemoval
            ? memberPendingRemoval.role === "owner"
              ? "This member is the current owner. Transfer ownership first, then remove owner access."
              : `Remove access for ${memberPendingRemoval.email}? They can be invited again later.`
            : ""
        }
        confirmLabel={updatingMemberId === memberPendingRemoval?.id ? "Removing..." : "Remove Member"}
        onConfirm={handleRemoveMember}
        loading={updatingMemberId === memberPendingRemoval?.id}
        confirmClassName="bg-rose-600 hover:bg-rose-700"
      />

      <Dialog
        open={showOwnerTransferDialog}
        onOpenChange={(open) => {
          setShowOwnerTransferDialog(open);
          if (!open) {
            setOwnerTransferTargetMemberId("");
            setMemberPendingRemoval(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Transfer ownership to another member before removing the current owner.
          </p>
          <div>
            <Label>New Owner</Label>
            <Select
              value={ownerTransferTargetMemberId}
              onValueChange={setOwnerTransferTargetMemberId}
              disabled={ownerTransferCandidates.length === 0}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {ownerTransferCandidates.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.email} ({getRoleLabel(member.role)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ownerTransferCandidates.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Add another workspace member before transferring ownership.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowOwnerTransferDialog(false);
                setOwnerTransferTargetMemberId("");
                setMemberPendingRemoval(null);
              }}
              disabled={updatingMemberId === memberPendingRemoval?.id}
            >
              Cancel
            </Button>
            <Button
              className="bg-slate-900 hover:bg-slate-800"
              onClick={handleTransferOwnershipAndRemoveMember}
              disabled={!ownerTransferTargetMemberId || updatingMemberId === memberPendingRemoval?.id}
            >
              {updatingMemberId === memberPendingRemoval?.id
                ? "Transferring..."
                : "Transfer and Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      ) : null}
    </PageShell>
  );
}
