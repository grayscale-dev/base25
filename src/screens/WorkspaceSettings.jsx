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
import { StateBanner, StatePanel } from "@/components/common/StateDisplay";
import { getBoardSession, setBoardSession } from "@/lib/board-session";
import { workspaceDefaultUrl, workspaceUrl } from "@/components/utils/boardUrl";
import AccountSettingsPanel from "@/components/workspace/AccountSettingsPanel";
import WorkspaceApiPanel from "@/components/workspace/WorkspaceApiPanel";
import WorkspaceBillingPanel from "@/components/workspace/WorkspaceBillingPanel";
import {
  DEFAULT_GROUP_STATUSES,
  ITEM_GROUP_KEYS,
  ITEM_GROUP_LABELS,
  sanitizeStatusKey,
} from "@/lib/item-groups";

const SETTINGS_TABS = ["my-account", "general", "access", "status-groups", "billing", "api"];

function byDisplayOrder(a, b) {
  return (a.display_order || 0) - (b.display_order || 0);
}

export default function WorkspaceSettings() {
  const navigate = useNavigate();
  const location = useLocation();

  const [workspace, setWorkspace] = useState(null);
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState({ tone: "info", message: "" });
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
  const [updatingMemberId, setUpdatingMemberId] = useState(null);
  const [memberPendingRemoval, setMemberPendingRemoval] = useState(null);
  const [accessCodeStatus, setAccessCodeStatus] = useState({ hasCode: false, expiresAt: null });
  const [accessCodeExpiry, setAccessCodeExpiry] = useState("7d");
  const [generatedAccessCode, setGeneratedAccessCode] = useState("");
  const [creatingAccessCode, setCreatingAccessCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [statusGroups, setStatusGroups] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [statusDrafts, setStatusDrafts] = useState({});
  const [savingStatusId, setSavingStatusId] = useState(null);
  const [showDeleteBoardDialog, setShowDeleteBoardDialog] = useState(false);
  const [deletingBoard, setDeletingBoard] = useState(false);
  const [activeTab, setActiveTab] = useState("my-account");

  useEffect(() => {
    const { workspace: storedWorkspace, role: storedRole } = getBoardSession();
    if (!storedWorkspace) {
      navigate(createPageUrl("Workspaces"));
      return;
    }

    const resolvedRole = storedRole || "viewer";
    const adminRole = resolvedRole === "admin";

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
    if (requestedTab !== "my-account" && role !== "admin") {
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
    if (role !== "admin" && nextTab !== "my-account") {
      return;
    }
    setActiveTab(nextTab);

    const params = new URLSearchParams(location.search || "");
    const defaultTab = role === "admin" ? "general" : "my-account";
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

  const loadAll = async (workspaceId) => {
    try {
      setInitialLoadError("");
      setLoading(true);

      const [rolesData, accessCodeData] = await Promise.all([
        base44.entities.BoardRole.filter({ board_id: workspaceId }),
        base44.functions.invoke("getBoardAccessCodeStatus", { board_id: workspaceId }),
      ]);

      setMembers(rolesData);
      setAccessCodeStatus({
        hasCode: Boolean(accessCodeData?.data?.has_code),
        expiresAt: accessCodeData?.data?.expires_at ?? null,
      });

      await ensureStatusConfig(workspaceId);
    } catch (error) {
      console.error("Failed to load workspace settings:", error);
      setInitialLoadError("Unable to load workspace settings. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const ensureStatusConfig = async (workspaceId) => {
    const [groupRows, statusRows] = await Promise.all([
      base44.entities.ItemStatusGroup.filter({ board_id: workspaceId }, "display_order"),
      base44.entities.ItemStatus.filter({ board_id: workspaceId }, "display_order"),
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
        board_id: workspaceId,
        group_key: groupKey,
        display_name: ITEM_GROUP_LABELS[groupKey],
        display_order: index,
      });
      createdGroups.push(group);

      for (const [statusIndex, status] of (DEFAULT_GROUP_STATUSES[groupKey] || []).entries()) {
        const created = await base44.entities.ItemStatus.create({
          board_id: workspaceId,
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
    setStatusBanner({ tone: "info", message: "" });

    if (slug !== workspace.slug) {
      const validationError = validateSlug(slug);
      if (validationError) {
        setSlugError(validationError);
        return;
      }
      const existing = await base44.entities.Board.filter({ slug });
      if (existing.length > 0 && existing[0].id !== workspace.id) {
        setSlugError("This slug is already taken.");
        return;
      }
    }

    setSaving(true);
    try {
      await base44.entities.Board.update(workspace.id, {
        name,
        slug,
        description,
        visibility,
        settings,
        logo_url: logoUrl,
        primary_color: primaryColor,
      });

      const updatedWorkspace = {
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
      setBoardSession({ workspace: updatedWorkspace, role: "admin", isPublicAccess: false });
      setStatusBanner({ tone: "success", message: "Workspace settings saved." });

      if (slug !== workspace.slug) {
        navigate(workspaceDefaultUrl(slug, "admin", false));
      }
    } catch (error) {
      console.error("Failed to save workspace settings:", error);
      setStatusBanner({ tone: "danger", message: "Failed to save settings. Please try again." });
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
    setStatusBanner({ tone: "success", message: "Workspace URL copied." });
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url: uploadedUrl } = await base44.integrations.Core.UploadFile({ file });
      setLogoUrl(uploadedUrl);
      setStatusBanner({ tone: "success", message: "Logo uploaded. Save changes to publish it." });
    } catch (error) {
      console.error("Failed to upload logo:", error);
      setStatusBanner({ tone: "danger", message: "Failed to upload logo." });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUpdateMemberRole = async (memberId, nextRole) => {
    setUpdatingMemberId(memberId);
    try {
      await base44.entities.BoardRole.update(memberId, { role: nextRole });
      setMembers((prev) =>
        prev.map((member) => (member.id === memberId ? { ...member, role: nextRole } : member))
      );
    } catch (error) {
      console.error("Failed to update member role:", error);
      setStatusBanner({ tone: "danger", message: "Failed to update member role." });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberPendingRemoval) return;
    setUpdatingMemberId(memberPendingRemoval.id);
    try {
      await base44.entities.BoardRole.delete(memberPendingRemoval.id);
      setMembers((prev) => prev.filter((member) => member.id !== memberPendingRemoval.id));
      setStatusBanner({ tone: "success", message: "Member removed." });
    } catch (error) {
      console.error("Failed to remove member:", error);
      setStatusBanner({ tone: "danger", message: "Failed to remove member." });
    } finally {
      setUpdatingMemberId(null);
      setMemberPendingRemoval(null);
    }
  };

  const handleCreateAccessCode = async () => {
    if (!workspace) return;
    setCreatingAccessCode(true);
    setStatusBanner({ tone: "info", message: "" });
    try {
      const { data } = await base44.functions.invoke("setBoardAccessCode", {
        board_id: workspace.id,
        expires_in: accessCodeExpiry,
      });
      setGeneratedAccessCode(data?.access_code ?? "");
      setAccessCodeStatus({
        hasCode: true,
        expiresAt: data?.expires_at ?? null,
      });
      setStatusBanner({ tone: "success", message: "Access code generated." });
    } catch (error) {
      console.error("Failed to create access code:", error);
      setStatusBanner({ tone: "danger", message: "Failed to create access code." });
    } finally {
      setCreatingAccessCode(false);
    }
  };

  const handleGroupNameSave = async (groupId, nextName) => {
    const trimmed = nextName.trim();
    if (!trimmed) {
      setStatusBanner({ tone: "danger", message: "Group name cannot be empty." });
      return;
    }
    try {
      const updated = await base44.entities.ItemStatusGroup.update(groupId, {
        display_name: trimmed,
      });
      setStatusGroups((prev) => prev.map((group) => (group.id === groupId ? updated : group)));
      setStatusBanner({ tone: "success", message: "Status group name saved." });
    } catch (error) {
      console.error("Failed to update status group:", error);
      setStatusBanner({ tone: "danger", message: "Failed to update status group name." });
    }
  };

  const handleStatusSave = async (statusId, patch) => {
    const nextLabel = patch.label?.trim();
    const nextKey = sanitizeStatusKey(patch.status_key || patch.key);
    const groupKey = patch.group_key;

    if (!nextLabel) {
      setStatusBanner({ tone: "danger", message: "Status label is required." });
      return;
    }
    if (!nextKey) {
      setStatusBanner({ tone: "danger", message: "Status key is required." });
      return;
    }

    const duplicate = statuses.find(
      (status) =>
        status.id !== statusId &&
        status.group_key === groupKey &&
        status.status_key === nextKey
    );
    if (duplicate) {
      setStatusBanner({ tone: "danger", message: "Status key must be unique within each group." });
      return;
    }

    setSavingStatusId(statusId);
    try {
      const updated = await base44.entities.ItemStatus.update(statusId, {
        label: nextLabel,
        status_key: nextKey,
      });
      setStatuses((prev) => prev.map((status) => (status.id === statusId ? updated : status)));
      setStatusBanner({ tone: "success", message: "Status saved." });
    } catch (error) {
      console.error("Failed to update status:", error);
      setStatusBanner({ tone: "danger", message: "Failed to update status." });
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
        board_id: workspace.id,
        group_key: groupKey,
        status_key: resolvedKey,
        label: "New Status",
        display_order: groupStatuses.length,
        is_active: true,
      });
      setStatuses((prev) => [...prev, created].sort(byDisplayOrder));
      setStatusBanner({ tone: "success", message: "Status added." });
    } catch (error) {
      console.error("Failed to add status:", error);
      setStatusBanner({ tone: "danger", message: "Failed to add status." });
    }
  };

  const handleDeleteStatus = async (statusRecord) => {
    const groupStatuses = groupedStatuses[statusRecord.group_key] || [];
    if (groupStatuses.length <= 1) {
      setStatusBanner({ tone: "danger", message: "Each group must keep at least one status." });
      return;
    }

    try {
      await base44.entities.ItemStatus.delete(statusRecord.id);
      setStatuses((prev) => prev.filter((status) => status.id !== statusRecord.id));
      setStatusBanner({ tone: "success", message: "Status removed." });
    } catch (error) {
      console.error("Failed to delete status:", error);
      setStatusBanner({ tone: "danger", message: "Failed to remove status." });
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace) return;
    setDeletingBoard(true);
    try {
      await base44.entities.Board.update(workspace.id, { status: "archived" });
      sessionStorage.clear();
      navigate(createPageUrl("Workspaces"));
    } catch (error) {
      console.error("Failed to archive workspace:", error);
      setStatusBanner({ tone: "danger", message: "Failed to delete workspace." });
    } finally {
      setDeletingBoard(false);
      setShowDeleteBoardDialog(false);
    }
  };

  const isAdmin = role === "admin";

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
      <StateBanner tone={statusBanner.tone} message={statusBanner.message} />

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
              setStatusBanner(nextStatus);
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
                <Input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 max-w-md" />
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
            <Button variant="destructive" onClick={() => setShowDeleteBoardDialog(true)}>
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
                    {members.map((member) => (
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
                    ))}
                  </TableBody>
                </Table>
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
        open={showDeleteBoardDialog}
        onOpenChange={setShowDeleteBoardDialog}
        title="Delete Workspace"
        description="This archives the workspace and removes access for everyone. This action cannot be undone."
        confirmLabel={deletingBoard ? "Deleting..." : "Delete Workspace"}
        onConfirm={handleDeleteWorkspace}
        loading={deletingBoard}
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
            ? `Remove access for ${memberPendingRemoval.email}? They can be invited again later.`
            : ""
        }
        confirmLabel={updatingMemberId === memberPendingRemoval?.id ? "Removing..." : "Remove Member"}
        onConfirm={handleRemoveMember}
        loading={updatingMemberId === memberPendingRemoval?.id}
        confirmClassName="bg-rose-600 hover:bg-rose-700"
      />
        </>
      ) : null}
    </PageShell>
  );
}
