import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getGroupLabel,
  getMetadataShapeForGroup,
  normalizeGroupKey,
  validateMetadata,
} from "@/lib/item-groups";
import AssigneeDisplay from "./AssigneeDisplay";

export default function ItemEditorDialog({
  open,
  onOpenChange,
  onSave,
  saving,
  item,
  availableGroupKeys,
  availableStatusesByGroup,
  itemTypes = [],
  assigneeOptions = [],
  canAssign = false,
  canManageGroupTransition,
  defaultGroup = "feedback",
  contributorFeedbackMode = false,
}) {
  const isContributorFeedbackSubmit = contributorFeedbackMode && !item;
  const isInternalCreate = !item && !isContributorFeedbackSubmit;
  const initialGroup = normalizeGroupKey(item?.group_key || defaultGroup);
  const [groupKey, setGroupKey] = useState(initialGroup);
  const [statusId, setStatusId] = useState(item?.status_id || "");
  const [itemTypeId, setItemTypeId] = useState(item?.item_type_id || "");
  const [assignedTo, setAssignedTo] = useState(item?.assigned_to || "");
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [metadata, setMetadata] = useState(item?.metadata || getMetadataShapeForGroup(initialGroup));
  const [error, setError] = useState("");
  const statusTriggerRef = useRef(null);
  const statusMenuRef = useRef(null);

  useEffect(() => {
    const nextGroup = normalizeGroupKey(item?.group_key || defaultGroup);
    setGroupKey(nextGroup);
    setStatusId(item?.status_id || "");
    setItemTypeId(item?.item_type_id || "");
    setAssignedTo(item?.assigned_to || "");
    setTitle(item?.title || "");
    setDescription(item?.description || "");
    setMetadata(item?.metadata || getMetadataShapeForGroup(nextGroup));
    setError("");
  }, [item, defaultGroup, open]);

  const statusOptions = availableStatusesByGroup[groupKey] || [];
  const combinedStatusOptions = useMemo(() => {
    return availableGroupKeys.flatMap((key) =>
      (availableStatusesByGroup[key] || []).map((status) => ({
        ...status,
        group_key: key,
      }))
    );
  }, [availableGroupKeys, availableStatusesByGroup]);
  const statusGroupById = useMemo(() => {
    const map = new Map();
    combinedStatusOptions.forEach((status) => {
      if (!status?.id) return;
      map.set(status.id, status.group_key);
    });
    return map;
  }, [combinedStatusOptions]);
  const selectableStatusOptions = isInternalCreate ? combinedStatusOptions : statusOptions;
  const statusSections = useMemo(() => {
    return availableGroupKeys
      .map((key) => ({
        groupKey: key,
        groupLabel: getGroupLabel(key),
        statuses: (availableStatusesByGroup[key] || []).map((status) => ({
          ...status,
          group_key: key,
        })),
      }))
      .filter((section) => section.statuses.length > 0);
  }, [availableGroupKeys, availableStatusesByGroup]);
  const sortedItemTypes = itemTypes
    .filter((itemType) => itemType?.is_active !== false)
    .slice()
    .sort((left, right) => (left.display_order || 0) - (right.display_order || 0));
  const validAssigneeOptions = useMemo(() => {
    const seen = new Set();
    return (assigneeOptions || [])
      .filter((member) => member?.user_id && !seen.has(member.user_id) && seen.add(member.user_id))
      .map((member) => ({
        ...member,
        display_label:
          member.display_name ||
          [member.first_name, member.last_name].filter(Boolean).join(" ").trim() ||
          member.full_name ||
          member.email ||
          "Unknown member",
      }));
  }, [assigneeOptions]);
  const selectedAssigneeOption = useMemo(
    () => validAssigneeOptions.find((member) => member.user_id === assignedTo) || null,
    [validAssigneeOptions, assignedTo]
  );

  useEffect(() => {
    if (!statusId && selectableStatusOptions.length > 0) {
      const fallbackStatusId = selectableStatusOptions[0].id;
      setStatusId(fallbackStatusId);
      if (isInternalCreate) {
        const fallbackGroupKey = statusGroupById.get(fallbackStatusId);
        if (fallbackGroupKey && fallbackGroupKey !== groupKey) {
          setGroupKey(fallbackGroupKey);
          setMetadata(getMetadataShapeForGroup(fallbackGroupKey));
        }
      }
      return;
    }

    if (statusId && selectableStatusOptions.length > 0) {
      const stillValid = selectableStatusOptions.some((status) => status.id === statusId);
      if (!stillValid) {
        const fallbackStatusId = selectableStatusOptions[0].id;
        setStatusId(fallbackStatusId);
        if (isInternalCreate) {
          const fallbackGroupKey = statusGroupById.get(fallbackStatusId);
          if (fallbackGroupKey && fallbackGroupKey !== groupKey) {
            setGroupKey(fallbackGroupKey);
            setMetadata(getMetadataShapeForGroup(fallbackGroupKey));
          }
        }
      }
      return;
    }

    if (isInternalCreate && statusId) {
      const selectedGroupKey = statusGroupById.get(statusId);
      if (selectedGroupKey && selectedGroupKey !== groupKey) {
        setGroupKey(selectedGroupKey);
        setMetadata(getMetadataShapeForGroup(selectedGroupKey));
      }
    }
  }, [statusId, selectableStatusOptions, isInternalCreate, statusGroupById, groupKey]);

  useEffect(() => {
    if (!itemTypeId && sortedItemTypes.length > 0) {
      setItemTypeId(sortedItemTypes[0].id);
      return;
    }
    if (itemTypeId && sortedItemTypes.length > 0) {
      const stillValid = sortedItemTypes.some((itemType) => itemType.id === itemTypeId);
      if (!stillValid) {
        setItemTypeId(sortedItemTypes[0].id);
      }
    }
  }, [itemTypeId, sortedItemTypes]);

  const handleGroupChange = (nextGroup) => {
    setGroupKey(nextGroup);
    setMetadata(getMetadataShapeForGroup(nextGroup));
    setError("");
  };

  const handleStatusChange = (nextStatusId) => {
    setStatusId(nextStatusId);
    if (isInternalCreate) {
      const selectedGroupKey = statusGroupById.get(nextStatusId);
      if (selectedGroupKey && selectedGroupKey !== groupKey) {
        setGroupKey(selectedGroupKey);
        setMetadata(getMetadataShapeForGroup(selectedGroupKey));
      }
    }
    setError("");
  };

  const positionStatusMenuBelow = () => {
    if (typeof window === "undefined") return;
    const trigger = statusTriggerRef.current;
    const overlay = statusMenuRef.current?.getElement?.();
    if (!trigger || !overlay) return;

    const triggerRect = trigger.getBoundingClientRect();
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft || 0;
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;

    overlay.style.left = `${triggerRect.left + scrollLeft}px`;
    overlay.style.top = `${triggerRect.bottom + scrollTop + 8}px`;
    overlay.setAttribute("data-p-overlaypanel-flipped", "false");
    overlay.classList.remove("p-overlaypanel-flipped");
  };

  const selectedStatusRecord =
    selectableStatusOptions.find((status) => status.id === statusId) || selectableStatusOptions[0] || null;
  const selectedGroupKey = selectedStatusRecord?.group_key || groupKey;
  const selectedStatusLabel = selectedStatusRecord?.label || "Select status";
  const selectedStatusDisplayLabel = `${getGroupLabel(selectedGroupKey)} • ${selectedStatusLabel}`;

  const submit = () => {
    const resolvedStatusId = statusId || selectableStatusOptions[0]?.id || "";
    const resolvedItemTypeId = itemTypeId || sortedItemTypes[0]?.id || "";
    const resolvedMetadata = isContributorFeedbackSubmit
      ? getMetadataShapeForGroup(groupKey)
      : metadata;

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!resolvedStatusId) {
      setError("Status is required.");
      return;
    }
    if (!resolvedItemTypeId) {
      setError("Item type is required.");
      return;
    }

    const metadataValidation = validateMetadata(groupKey, resolvedMetadata);
    if (!metadataValidation.valid) {
      setError(metadataValidation.message);
      return;
    }

    onSave({
      id: item?.id || null,
      status_id: resolvedStatusId,
      item_type_id: resolvedItemTypeId,
      assigned_to: isContributorFeedbackSubmit ? null : assignedTo || null,
      title: title.trim(),
      description: description.trim(),
      metadata: resolvedMetadata,
      visibility: item?.visibility || "public",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : isContributorFeedbackSubmit ? "Submit feedback" : "Create item"}</DialogTitle>
          <DialogDescription>
            {isContributorFeedbackSubmit
              ? "Share your feedback with a clear title and description."
              : "Create an item. The description appears above comments in the item view."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isContributorFeedbackSubmit ? (
            isInternalCreate ? (
              <div>
                <Label>Group + Status</Label>
                <div className="mt-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(event) => {
                        statusTriggerRef.current = event.currentTarget;
                      }}
                    >
                      <button
                        type="button"
                        className={cn(
                          "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                        )}
                        disabled={saving}
                        aria-label="Select group and status"
                      >
                        <span className="line-clamp-1">{selectedStatusDisplayLabel}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      ref={statusMenuRef}
                      onShow={positionStatusMenuBelow}
                      className="w-72"
                      style={{ maxHeight: "18rem", overflowY: "auto" }}
                    >
                      {statusSections.map((section, sectionIndex) => (
                        <div key={section.groupKey}>
                          <DropdownMenuLabel className="px-2 pb-1 pt-2 text-xs uppercase tracking-wide text-slate-500">
                            {section.groupLabel}
                          </DropdownMenuLabel>
                          {section.statuses.map((status) => {
                            const isCurrent = status.id === statusId;
                            return (
                              <DropdownMenuItem
                                key={`${section.groupKey}:${status.id}`}
                                className={cn("w-full justify-between", isCurrent && "bg-slate-100 text-slate-900")}
                                disabled={saving}
                                onClick={() => handleStatusChange(status.id)}
                              >
                                <span>{status.label || "Unnamed status"}</span>
                                {isCurrent ? <Check className="h-4 w-4 text-slate-600" /> : null}
                              </DropdownMenuItem>
                            );
                          })}
                          {sectionIndex < statusSections.length - 1 ? <DropdownMenuSeparator /> : null}
                        </div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Group</Label>
                  <Select
                    value={groupKey}
                    onValueChange={handleGroupChange}
                    disabled={saving || (item && !canManageGroupTransition)}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGroupKeys.map((key) => (
                        <SelectItem key={key} value={key}>
                          {getGroupLabel(key)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={statusId} onValueChange={handleStatusChange} disabled={saving}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          ) : null}

          {!isContributorFeedbackSubmit ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Item Type</Label>
                <Select value={itemTypeId} onValueChange={setItemTypeId} disabled={saving}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedItemTypes.map((itemType) => (
                      <SelectItem key={itemType.id} value={itemType.id}>
                        {itemType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {groupKey === "feedback" ? (
                <div>
                  <Label>Assignee</Label>
                  <div className="mt-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                          )}
                          disabled={saving || !canAssign}
                          aria-label="Select assignee"
                        >
                          <AssigneeDisplay
                            assignee={
                              selectedAssigneeOption
                                ? {
                                    name: selectedAssigneeOption.display_label,
                                    profile_photo_url: selectedAssigneeOption.profile_photo_url || null,
                                  }
                                : null
                            }
                            fallback="Unassigned"
                            sizeClassName="h-5 w-5"
                            textClassName="text-sm text-slate-700"
                          />
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-64">
                        <DropdownMenuItem
                          className="w-full justify-between"
                          disabled={saving || !canAssign}
                          onClick={() => setAssignedTo("")}
                        >
                          <span>Unassigned</span>
                          {!assignedTo ? <Check className="h-4 w-4 text-slate-600" /> : null}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {validAssigneeOptions.map((member) => {
                          const isCurrent = assignedTo === member.user_id;
                          return (
                            <DropdownMenuItem
                              key={member.user_id}
                              className={cn(
                                "w-full justify-between",
                                isCurrent && "bg-slate-100 text-slate-900"
                              )}
                              disabled={saving || !canAssign}
                              onClick={() => setAssignedTo(member.user_id)}
                            >
                              <AssigneeDisplay
                                assignee={{
                                  name: member.display_label,
                                  profile_photo_url: member.profile_photo_url || null,
                                }}
                                sizeClassName="h-5 w-5"
                                textClassName="text-sm text-slate-700"
                              />
                              {isCurrent ? <Check className="h-4 w-4 text-slate-600" /> : null}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5" disabled={saving} />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1.5 min-h-[120px]"
              placeholder="Describe the request or issue."
              disabled={saving}
            />
          </div>

          {!isContributorFeedbackSubmit && Boolean(item) && groupKey === "feedback" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Type</Label>
                <Select
                  value={metadata.type || "feature_request"}
                  onValueChange={(value) => setMetadata({ ...metadata, type: value })}
                  disabled={saving}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature_request">Feature request</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                    <SelectItem value="question">Question</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={metadata.priority || "medium"}
                  onValueChange={(value) => setMetadata({ ...metadata, priority: value })}
                  disabled={saving}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {!isContributorFeedbackSubmit && groupKey === "changelog" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Release date</Label>
                <Input
                  type="date"
                  value={metadata.release_date || ""}
                  onChange={(event) =>
                    setMetadata({ ...metadata, release_date: event.target.value })
                  }
                  className="mt-1.5"
                  disabled={saving}
                />
              </div>
              <div>
                <Label>Entry type</Label>
                <Select
                  value={metadata.announcement_type || "release"}
                  onValueChange={(value) =>
                    setMetadata({ ...metadata, announcement_type: value })
                  }
                  disabled={saving}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="release">Release</SelectItem>
                    <SelectItem value="hotfix">Hotfix</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="bg-slate-900 hover:bg-slate-800">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : item ? (
              "Save changes"
            ) : isContributorFeedbackSubmit ? (
              "Submit feedback"
            ) : (
              "Create item"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
