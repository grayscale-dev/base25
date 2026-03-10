import { useCallback, useEffect, useState } from "react";
import Link from "@/components/common/AppLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { workspaceItemUrl } from "@/components/utils/workspaceUrl";
import ItemDetailPanel from "./ItemDetailPanel";
import { ExternalLink, Pencil, X } from "lucide-react";

export default function ItemDetailDrawer({
  open,
  onOpenChange,
  workspaceSlug,
  controller,
  item,
  isAdmin,
  onDeleted,
}) {
  const [visibleItem, setVisibleItem] = useState(item || null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    if (item) {
      setVisibleItem(item);
    }
  }, [item]);

  useEffect(() => {
    setIsEditingTitle(false);
    setTitleDraft(visibleItem?.title || "");
  }, [visibleItem?.id, visibleItem?.updated_at, visibleItem?.updated_date]);

  const handleOpenChange = (nextOpen) => {
    onOpenChange?.(nextOpen);
  };

  const handleDrawerExited = useCallback(() => {
    controller.setSelectedItem(null);
    setVisibleItem(null);
  }, [controller]);

  const saveTitle = async () => {
    if (!visibleItem?.id) return;
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      controller.setError("Title is required.");
      return;
    }

    const result = await controller.saveItem({
      payload: {
        id: visibleItem.id,
        group_key: visibleItem.group_key,
        status_key: visibleItem.status_key,
        title: nextTitle,
        description: visibleItem.description || "",
        metadata: visibleItem.metadata || {},
        visibility: visibleItem.visibility || "public",
      },
      previousItem: visibleItem,
    });

    if (!result.ok) {
      controller.setError(result.error);
      return;
    }

    await controller.loadItemActivities(result.item || visibleItem);
    setIsEditingTitle(false);
  };

  const handleDeleted = () => {
    onDeleted?.();
    handleOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseIcon={false}
        transitionOptions={{
          timeout: { enter: 260, exit: 220 },
          classNames: "base25-item-drawer-transition",
          onExited: handleDrawerExited,
        }}
        className="h-full w-full max-w-3xl overflow-y-auto p-0"
      >
        {visibleItem ? (
          <div className="min-h-[100dvh] bg-white">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
              <div className="min-w-0 flex-1">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      className="h-9 min-w-[26rem] flex-1 bg-white"
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
                          setTitleDraft(visibleItem.title || "");
                          setIsEditingTitle(false);
                        }}
                      disabled={controller.savingItem}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-slate-900">{visibleItem.title}</h2>
                    {isAdmin ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600"
                        onClick={() => {
                          setTitleDraft(visibleItem.title || "");
                          setIsEditingTitle(true);
                        }}
                        aria-label="Edit item title"
                        title="Edit item title"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  aria-label="Open item in new tab"
                  title="Open in new tab"
                >
                  <Link
                    to={workspaceItemUrl(workspaceSlug, visibleItem.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenChange(false)}
                  aria-label="Close item details"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <div className="px-5 py-4">
              <ItemDetailPanel
                controller={controller}
                item={visibleItem}
                isAdmin={isAdmin}
                onDeleted={handleDeleted}
              />
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
