import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { GripVertical, Loader2, Pencil, Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  const [movingRoadmapItemId, setMovingRoadmapItemId] = useState(null);

  const isAdmin = isAdminRole(role) && !isPublicAccess;
  const isContributorFeedback =
    !isPublicAccess && role === "contributor" && groupKey === "feedback";
  const canCreateItems = isAdmin || isContributorFeedback;

  useEffect(() => {
    const statusId = groupKey === "roadmap" ? "all" : activeStatusFilter;
    void controller.loadItems({ groupKey, statusId });
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
    await controller.loadItems({ groupKey, statusId: groupKey === "roadmap" ? "all" : activeStatusFilter });
  };

  const handleRoadmapDragEnd = async (result) => {
    if (!isAdmin) return;
    const { destination, draggableId } = result;
    if (!destination) return;

    const item = controller.items.find((entry) => entry.id === draggableId);
    if (!item) return;
    if (item.status_id === destination.droppableId) return;

    setMovingRoadmapItemId(item.id);
    try {
      const saveResult = await controller.saveItem({
        payload: {
          id: item.id,
          status_id: destination.droppableId,
          item_type_id: item.item_type_id,
          assigned_to: item.assigned_to || null,
          title: item.title,
          description: item.description || "",
          metadata: item.metadata || {},
          visibility: item.visibility || "public",
        },
        previousItem: item,
      });

      if (!saveResult.ok) {
        controller.setError(saveResult.error);
      } else {
        await controller.loadItems({ groupKey, statusId: "all" });
      }
    } finally {
      setMovingRoadmapItemId(null);
    }
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
          {groupKey === "roadmap" ? (
            <p className="text-xs text-slate-500">
              Roadmap is shown as a Kanban board.
            </p>
          ) : (
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
          )}
        </div>
      </div>

      {controller.error ? (
        <StatePanel
          tone="danger"
          title="Unable to load items"
          description={controller.error}
          action={() => controller.loadItems({ groupKey, statusId: groupKey === "roadmap" ? "all" : activeStatusFilter })}
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
      ) : groupKey === "roadmap" ? (
        <div className="overflow-x-auto">
          <DragDropContext onDragEnd={handleRoadmapDragEnd}>
            <div className="flex min-w-max gap-4 pb-1">
              {groupStatuses.map((status) => {
                const statusItems = controller.items.filter((item) => item.status_id === status.id);
                return (
                  <Droppable key={status.id} droppableId={status.id} isDropDisabled={!isAdmin}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "w-80 rounded-xl border border-slate-200 bg-white p-3",
                          snapshot.isDraggingOver && isAdmin && "border-[var(--workspace-brand)] bg-[var(--workspace-brand-soft)]/40"
                        )}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">{status.label}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {statusItems.length}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {statusItems.map((item, index) => (
                            <Draggable
                              key={item.id}
                              draggableId={item.id}
                              index={index}
                              isDragDisabled={!isAdmin}
                            >
                              {(dragProvided, dragSnapshot) => (
                                <article
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={cn(
                                    "cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm",
                                    dragSnapshot.isDragging && "border-slate-300 shadow-md"
                                  )}
                                  onClick={() => {
                                    void openItemThread(item);
                                  }}
                                >
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <p className="line-clamp-2 text-sm font-medium text-slate-900">{item.title}</p>
                                    {isAdmin ? (
                                      <button
                                        type="button"
                                        {...dragProvided.dragHandleProps}
                                        className="text-slate-400 hover:text-slate-600"
                                        aria-label="Drag roadmap item"
                                      >
                                        <GripVertical className="h-4 w-4" />
                                      </button>
                                    ) : null}
                                  </div>
                                  <p className="line-clamp-3 text-xs text-slate-600">
                                    {item.description || "No description provided."}
                                  </p>
                                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                                    <span>{Number(item.reaction_count || 0)} reactions</span>
                                    <span>
                                      Updated{" "}
                                      <RelativeDate
                                        value={item.updated_date || item.updated_at || item.created_date || item.created_at}
                                      />
                                    </span>
                                  </div>
                                  {movingRoadmapItemId === item.id ? (
                                    <div className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Updating...
                                    </div>
                                  ) : null}
                                </article>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        </div>
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                      {Number(item.reaction_count || 0) > 0 ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                          {item.reaction_count}
                        </span>
                      ) : null}
                    </div>
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
          await controller.loadItems({ groupKey, statusId: groupKey === "roadmap" ? "all" : activeStatusFilter });
        }}
      />
    </PageShell>
  );
}
