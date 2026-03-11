import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
  getGroupLabel,
  getMetadataShapeForGroup,
  normalizeGroupKey,
  validateMetadata,
} from "@/lib/item-groups";

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
  const initialGroup = normalizeGroupKey(item?.group_key || defaultGroup);
  const [groupKey, setGroupKey] = useState(initialGroup);
  const [statusId, setStatusId] = useState(item?.status_id || "");
  const [itemTypeId, setItemTypeId] = useState(item?.item_type_id || "");
  const [assignedTo, setAssignedTo] = useState(item?.assigned_to || "");
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [metadata, setMetadata] = useState(item?.metadata || getMetadataShapeForGroup(initialGroup));
  const [error, setError] = useState("");

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
  const sortedItemTypes = itemTypes
    .filter((itemType) => itemType?.is_active !== false)
    .slice()
    .sort((left, right) => (left.display_order || 0) - (right.display_order || 0));

  useEffect(() => {
    if (!statusId && statusOptions.length > 0) {
      setStatusId(statusOptions[0].id);
      return;
    }

    if (statusId && statusOptions.length > 0) {
      const stillValid = statusOptions.some((status) => status.id === statusId);
      if (!stillValid) {
        setStatusId(statusOptions[0].id);
      }
    }
  }, [statusId, statusOptions]);

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

  const submit = () => {
    const resolvedStatusId = statusId || statusOptions[0]?.id || "";
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
                <Select value={statusId} onValueChange={setStatusId} disabled={saving}>
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
                  <Select
                    value={assignedTo || "unassigned"}
                    onValueChange={(value) => setAssignedTo(value === "unassigned" ? "" : value)}
                    disabled={saving || !canAssign}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {assigneeOptions.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.display_name || member.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

          {!isContributorFeedbackSubmit && groupKey === "feedback" ? (
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

          {!isContributorFeedbackSubmit && groupKey === "roadmap" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Target quarter</Label>
                <Input
                  value={metadata.target_quarter || ""}
                  onChange={(event) =>
                    setMetadata({ ...metadata, target_quarter: event.target.value })
                  }
                  placeholder="Q2 2026"
                  className="mt-1.5"
                  disabled={saving}
                />
              </div>
              <div>
                <Label>Target date</Label>
                <Input
                  type="date"
                  value={metadata.target_date || ""}
                  onChange={(event) =>
                    setMetadata({ ...metadata, target_date: event.target.value })
                  }
                  className="mt-1.5"
                  disabled={saving}
                />
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
