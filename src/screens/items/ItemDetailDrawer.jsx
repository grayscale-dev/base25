import { useEffect, useState } from "react";
import Link from "@/components/common/AppLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { workspaceItemUrl } from "@/components/utils/boardUrl";
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    setIsEditingTitle(false);
    setTitleDraft(item?.title || "");
  }, [item?.id, item?.updated_at, item?.updated_date]);

  const handleOpenChange = (nextOpen) => {
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      controller.setSelectedItem(null);
    }
  };

  const saveTitle = async () => {
    if (!item?.id) return;
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      controller.setError("Title is required.");
      return;
    }

    const result = await controller.saveItem({
      payload: {
        id: item.id,
        group_key: item.group_key,
        status_key: item.status_key,
        title: nextTitle,
        description: item.description || "",
        metadata: item.metadata || {},
        visibility: item.visibility || "public",
      },
      previousItem: item,
    });

    if (!result.ok) {
      controller.setError(result.error);
      return;
    }

    await controller.loadItemActivities(result.item || item);
    setIsEditingTitle(false);
  };

  const handleDeleted = () => {
    onDeleted?.();
    handleOpenChange(false);
  };

  return (
    <Sheet open={open && Boolean(item)} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseIcon={false}
        className="h-full w-full max-w-3xl overflow-y-auto p-0"
      >
        {item ? (
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
                        setTitleDraft(item.title || "");
                        setIsEditingTitle(false);
                      }}
                      disabled={controller.savingItem}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-slate-900">{item.title}</h2>
                    {isAdmin ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600"
                        onClick={() => {
                          setTitleDraft(item.title || "");
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
                    to={workspaceItemUrl(workspaceSlug, item.id)}
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
                item={item}
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
