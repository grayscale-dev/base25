import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
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
import ItemEditorDialog from "./ItemEditorDialog";
import ItemDetailDrawer from "./ItemDetailDrawer";
import { getGroupLabel } from "@/lib/item-groups";
import { isAdminRole } from "@/lib/roles";

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

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

  const isAdmin = isAdminRole(role) && !isPublicAccess;

  useEffect(() => {
    void controller.loadItems({ groupKey, statusKey: activeStatusFilter });
  }, [groupKey, activeStatusFilter, workspace?.id]);

  const groupStatuses = useMemo(
    () => controller.statusesByGroup[groupKey] || [],
    [controller.statusesByGroup, groupKey]
  );

  const openCreate = () => {
    if (!isAdmin) return;
    setEditingItem(null);
    setShowEditor(true);
  };

  const openEdit = (item) => {
    if (!isAdmin) return;
    setEditingItem(item);
    setShowEditor(true);
  };

  const openItemThread = async (item) => {
    await controller.loadItemActivities(item);
    setShowItemDrawer(true);
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
    await controller.loadItems({ groupKey, statusKey: activeStatusFilter });
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
          isAdmin ? (
            <Button onClick={openCreate} className="bg-slate-900 hover:bg-slate-800">
              <Plus className="mr-2 h-4 w-4" />
              Create Item
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
                  <SelectItem key={status.id || status.status_key} value={status.status_key}>
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
          action={() => controller.loadItems({ groupKey, statusKey: activeStatusFilter })}
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
              groupStatuses.find((status) => status.status_key === item.status_key)?.label ||
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
                    <Badge variant="outline">{statusLabel}</Badge>
                    {isAdmin ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(item);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Updated {formatDate(item.updated_date || item.updated_at || item.created_date || item.created_at)}
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
        canManageGroupTransition={false}
        defaultGroup={groupKey}
      />

      <ItemDetailDrawer
        open={showItemDrawer}
        onOpenChange={setShowItemDrawer}
        workspaceSlug={workspace?.slug}
        controller={controller}
        item={controller.selectedItem}
        isAdmin={isAdmin}
        onDeleted={async () => {
          await controller.loadItems({ groupKey, statusKey: activeStatusFilter });
        }}
      />
    </PageShell>
  );
}
