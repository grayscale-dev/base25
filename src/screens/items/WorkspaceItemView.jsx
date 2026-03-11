import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { workspaceUrl } from "@/components/utils/workspaceUrl";
import { PageHeader, PageShell } from "@/components/common/PageScaffold";
import PageLoadingState from "@/components/common/PageLoadingState";
import { StatePanel } from "@/components/common/StateDisplay";
import { useNavigate } from "@/lib/router";
import { getGroupLabel } from "@/lib/item-groups";
import { getDefaultWorkspaceSection } from "@/lib/workspace-sections";
import { useItemsController } from "./useItemsController";
import ItemDetailPanel from "./ItemDetailPanel";
import { Pencil, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { isAdminRole } from "@/lib/roles";

export default function WorkspaceItemView({ workspace, role, isPublicAccess, itemId }) {
  const navigate = useNavigate();
  const controller = useItemsController({ workspace, role, isPublicAccess });
  const [loadingItem, setLoadingItem] = useState(true);
  const [itemError, setItemError] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadItem = async () => {
      if (!workspace?.id || !itemId) {
        setLoadingItem(false);
        setItemError("Item route is invalid.");
        return;
      }

      try {
        setLoadingItem(true);
        setItemError("");
        const rows = await base44.entities.Item.filter({
          workspace_id: workspace.id,
          id: itemId,
        });
        const item = rows?.[0];
        if (!item) {
          if (!cancelled) {
            setItemError("Item not found.");
          }
          return;
        }
        if (!cancelled) {
          await controller.loadItemActivities(item);
        }
      } catch (loadError) {
        console.error("Failed to load item:", loadError);
        if (!cancelled) {
          setItemError("Unable to load item.");
        }
      } finally {
        if (!cancelled) {
          setLoadingItem(false);
        }
      }
    };

    void loadItem();

    return () => {
      cancelled = true;
    };
  }, [workspace?.id, itemId]);

  const selectedItem = controller.selectedItem;
  const fallbackSection = getDefaultWorkspaceSection(role, isPublicAccess);
  const backSection = selectedItem?.group_key || fallbackSection;
  const backLabel = selectedItem?.group_key ? getGroupLabel(selectedItem.group_key) : "Workspace";
  const canDeleteSelectedItem = controller.canDeleteItem(selectedItem);
  const canEditTitle =
    (isAdminRole(role) && !isPublicAccess) ||
    (role === "contributor" &&
      !isPublicAccess &&
      selectedItem?.group_key === "feedback" &&
      selectedItem?.submitter_id === controller.currentUserId);

  useEffect(() => {
    setIsEditingTitle(false);
    setTitleDraft(selectedItem?.title || "");
  }, [selectedItem?.id, selectedItem?.updated_at, selectedItem?.updated_date]);

  const saveTitle = async () => {
    if (!selectedItem?.id) return;
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      controller.setError("Title is required.");
      return;
    }

    const result = await controller.saveItem({
      payload: {
        id: selectedItem.id,
        status_id: selectedItem.status_id,
        item_type_id: selectedItem.item_type_id,
        assigned_to: selectedItem.assigned_to || null,
        title: nextTitle,
        description: selectedItem.description || "",
        metadata: selectedItem.metadata || {},
        visibility: selectedItem.visibility || "public",
      },
      previousItem: selectedItem,
    });

    if (!result.ok) {
      controller.setError(result.error);
      return;
    }

    await controller.loadItemActivities(result.item || selectedItem);
    setIsEditingTitle(false);
  };

  const deleteItem = async () => {
    if (!selectedItem?.id) return;
    const result = await controller.deleteItem(selectedItem.id);
    if (!result.ok) {
      controller.setError(result.error);
      return;
    }
    navigate(workspaceUrl(workspace.slug, fallbackSection));
  };

  if (controller.loadingConfig || loadingItem) {
    return <PageLoadingState text="Loading item..." />;
  }

  if (controller.error || itemError) {
    return (
      <PageShell>
        <StatePanel
          tone="danger"
          title="Unable to open item"
          description={controller.error || itemError}
          action={() => navigate(workspaceUrl(workspace.slug, backSection))}
          actionLabel={`Back to ${backLabel}`}
        />
      </PageShell>
    );
  }

  if (!selectedItem) {
    return (
      <PageShell>
        <StatePanel
          tone="danger"
          title="Item not found"
          description="This item does not exist in the current workspace."
          action={() => navigate(workspaceUrl(workspace.slug, backSection))}
          actionLabel={`Back to ${backLabel}`}
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        titleNode={
          canEditTitle && isEditingTitle ? (
            <div className="flex max-w-3xl items-center gap-2">
              <Input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                className="h-10 min-w-[32rem] flex-1 bg-white"
              />
              <Button
                size="sm"
                onClick={() => {
                  void saveTitle();
                }}
                disabled={controller.savingItem}
                className="bg-slate-900 hover:bg-slate-800"
              >
                {controller.savingItem ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTitleDraft(selectedItem.title || "");
                  setIsEditingTitle(false);
                }}
                disabled={controller.savingItem}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              {selectedItem.title}
            </span>
          )
        }
        actions={
          (canEditTitle || canDeleteSelectedItem) && !isEditingTitle ? (
            <div className="flex items-center gap-1">
              {canEditTitle ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => {
                    setTitleDraft(selectedItem.title || "");
                    setIsEditingTitle(true);
                  }}
                  aria-label="Edit item title"
                  title="Edit item title"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {canDeleteSelectedItem ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => {
                    setDeleteDialogOpen(true);
                  }}
                  aria-label="Delete item"
                  title="Delete item"
                  disabled={controller.deletingItemId === selectedItem.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      <ItemDetailPanel
        controller={controller}
        item={selectedItem}
        isAdmin={isAdminRole(role) && !isPublicAccess}
        onDeleted={() => navigate(workspaceUrl(workspace.slug, fallbackSection))}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete this item?"
        description="This action permanently removes the item and its discussion history. This cannot be undone."
        confirmLabel={controller.deletingItemId === selectedItem.id ? "Deleting..." : "Delete Item"}
        onConfirm={() => {
          void deleteItem();
        }}
        loading={controller.deletingItemId === selectedItem.id}
        confirmClassName="bg-rose-600 hover:bg-rose-700"
      />
    </PageShell>
  );
}
