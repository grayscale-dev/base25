import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Badge from "@/components/common/Badge";
import { PageHeader, PageShell } from "@/components/common/PageScaffold";
import PageLoadingState from "@/components/common/PageLoadingState";
import PageEmptyState from "@/components/common/PageEmptyState";
import { StatePanel } from "@/components/common/StateDisplay";
import RelativeDate from "@/components/common/RelativeDate";
import ItemEditorDialog from "./ItemEditorDialog";
import ItemDetailDrawer from "./ItemDetailDrawer";
import AssigneeDisplay from "./AssigneeDisplay";
import { getGroupLabel } from "@/lib/item-groups";
import { isAdminRole } from "@/lib/roles";

export default function GroupItemsPage({
  groupKey,
  workspace,
  role,
  isPublicAccess,
  controller,
}) {
  const [activeStatusFilter, setActiveStatusFilter] = useState("all");
  const [showEditor, setShowEditor] = useState(false);
  const [showItemDrawer, setShowItemDrawer] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [openingItemId, setOpeningItemId] = useState(null);

  const isAdmin = isAdminRole(role) && !isPublicAccess;
  const isContributorFeedback =
    !isPublicAccess && role === "contributor" && groupKey === "feedback";
  const canCreateItems = isAdmin || isContributorFeedback;

  useEffect(() => {
    void controller.loadItems({ groupKey, statusId: activeStatusFilter });
  }, [groupKey, activeStatusFilter, workspace?.id]);

  const groupStatuses = useMemo(
    () => controller.statusesByGroup[groupKey] || [],
    [controller.statusesByGroup, groupKey]
  );

  const openCreate = () => {
    if (!canCreateItems) return;
    setEditingItem(null);
    setShowEditor(true);
  };

  const openEdit = (item) => {
    if (!isAdmin) return;
    setEditingItem(item);
    setShowEditor(true);
  };

  const openItemThread = async (item) => {
    setOpeningItemId(item.id);
    try {
      await controller.loadItemActivities(item);
      setShowItemDrawer(true);
    } finally {
      setOpeningItemId(null);
    }
  };

  const handleSaveItem = async (payload) => {
    const result = await controller.saveItem({
      payload,
      previousItem: editingItem,
    });
    if (!result.ok) {
      controller.setError(result.error);
      return;
    }
    setShowEditor(false);
    setEditingItem(null);
    await controller.loadItems({ groupKey, statusId: activeStatusFilter });
  };

  if (controller.loadingConfig) {
    return <PageLoadingState text="Loading workspace items..." />;
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title={getGroupLabel(groupKey)}
        description={`${getGroupLabel(groupKey)} items for ${workspace?.name}.`}
        actions={
          canCreateItems ? (
            <Button
              onClick={openCreate}
              disabled={controller.savingItem}
              aria-busy={controller.savingItem}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {controller.savingItem ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {controller.savingItem ? "Saving..." : isContributorFeedback ? "Submit Feedback" : "Create Item"}
            </Button>
          ) : null
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {controller.items.length} item{controller.items.length === 1 ? "" : "s"}
          </p>
          <div className="w-full sm:w-56">
            <Select value={activeStatusFilter} onValueChange={setActiveStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {groupStatuses.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {controller.error ? (
        <StatePanel
          tone="danger"
          title="Unable to load items"
          description={controller.error}
          action={() => controller.loadItems({ groupKey, statusId: activeStatusFilter })}
          actionLabel="Retry"
        />
      ) : null}

      {controller.loadingItems ? (
        <PageLoadingState text="Loading items..." />
      ) : controller.items.length === 0 ? (
        <PageEmptyState
          title={`No ${getGroupLabel(groupKey).toLowerCase()} items yet`}
          description={
            isAdmin
              ? "Create your first item to get started."
              : "There are no items in this section yet."
          }
        />
      ) : (
        <div className="space-y-4">
          {controller.items.map((item) => {
            const statusLabel =
              groupStatuses.find((status) => status.id === item.status_id)?.label ||
              item.status_label ||
              item.status_key;
            return (
              <article
                key={item.id}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
                onClick={() => {
                  void openItemThread(item);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-600">
                      {item.description || "No description provided."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-0 text-white"
                      style={{ backgroundColor: item.group_color || "#0F172A" }}
                    >
                      {statusLabel}
                    </Badge>
                    {item.group_key === "feedback" && !isPublicAccess ? (
                      <AssigneeDisplay
                        assignee={item.assignee}
                        fallback="Unassigned"
                        sizeClassName="h-5 w-5"
                        textClassName="text-xs text-slate-500"
                      />
                    ) : null}
                    {isAdmin ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(item);
                        }}
                        disabled={openingItemId === item.id}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {openingItemId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Updated{" "}
                  <RelativeDate value={item.updated_date || item.updated_at || item.created_date || item.created_at} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ItemEditorDialog
        open={showEditor}
        onOpenChange={setShowEditor}
        onSave={handleSaveItem}
        saving={controller.savingItem}
        item={editingItem}
        availableGroupKeys={[groupKey]}
        availableStatusesByGroup={controller.statusesByGroup}
        itemTypes={controller.itemTypes}
        assigneeOptions={controller.memberDirectory}
        canAssign={controller.canManageAssignee}
        canManageGroupTransition={false}
        defaultGroup={groupKey}
        contributorFeedbackMode={isContributorFeedback && !editingItem}
      />

      <ItemDetailDrawer
        open={showItemDrawer}
        onOpenChange={setShowItemDrawer}
        workspaceSlug={workspace?.slug}
        controller={controller}
        item={controller.selectedItem}
        isAdmin={isAdmin}
        showGroupContext={false}
        onDeleted={async () => {
          await controller.loadItems({ groupKey, statusId: activeStatusFilter });
        }}
      />
    </PageShell>
  );
}
