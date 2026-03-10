import { useEffect, useState } from "react";
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
  canManageGroupTransition,
  defaultGroup = "feedback",
}) {
  const initialGroup = normalizeGroupKey(item?.group_key || defaultGroup);
  const [groupKey, setGroupKey] = useState(initialGroup);
  const [statusKey, setStatusKey] = useState(item?.status_key || "");
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [metadata, setMetadata] = useState(item?.metadata || getMetadataShapeForGroup(initialGroup));
  const [error, setError] = useState("");

  useEffect(() => {
    const nextGroup = normalizeGroupKey(item?.group_key || defaultGroup);
    setGroupKey(nextGroup);
    setStatusKey(item?.status_key || "");
    setTitle(item?.title || "");
    setDescription(item?.description || "");
    setMetadata(item?.metadata || getMetadataShapeForGroup(nextGroup));
    setError("");
  }, [item, defaultGroup, open]);

  const statusOptions = availableStatusesByGroup[groupKey] || [];

  useEffect(() => {
    if (!statusKey && statusOptions.length > 0) {
      setStatusKey(statusOptions[0].status_key);
      return;
    }

    if (statusKey && statusOptions.length > 0) {
      const stillValid = statusOptions.some((status) => status.status_key === statusKey);
      if (!stillValid) {
        setStatusKey(statusOptions[0].status_key);
      }
    }
  }, [statusKey, statusOptions]);

  const handleGroupChange = (nextGroup) => {
    setGroupKey(nextGroup);
    setMetadata(getMetadataShapeForGroup(nextGroup));
    setError("");
  };

  const submit = () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!statusKey) {
      setError("Status is required.");
      return;
    }

    const metadataValidation = validateMetadata(groupKey, metadata);
    if (!metadataValidation.valid) {
      setError(metadataValidation.message);
      return;
    }

    onSave({
      id: item?.id || null,
      group_key: groupKey,
      status_key: statusKey,
      title: title.trim(),
      description: description.trim(),
      metadata,
      visibility: item?.visibility || "public",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Create item"}</DialogTitle>
          <DialogDescription>
            Create a question-style item. The initial post becomes the first message in the thread.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Group</Label>
              <Select
                value={groupKey}
                onValueChange={handleGroupChange}
                disabled={item && !canManageGroupTransition}
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
              <Select value={statusKey} onValueChange={setStatusKey}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.id || status.status_key} value={status.status_key}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5" />
          </div>

          <div>
            <Label>Initial post</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1.5 min-h-[120px]"
              placeholder="Describe the request or issue. This becomes the first post in the discussion thread."
            />
          </div>

          {groupKey === "feedback" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Type</Label>
                <Select
                  value={metadata.type || "feature_request"}
                  onValueChange={(value) => setMetadata({ ...metadata, type: value })}
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

          {groupKey === "roadmap" ? (
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
                />
              </div>
            </div>
          ) : null}

          {groupKey === "changelog" ? (
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
                />
              </div>
              <div>
                <Label>Entry type</Label>
                <Select
                  value={metadata.announcement_type || "release"}
                  onValueChange={(value) =>
                    setMetadata({ ...metadata, announcement_type: value })
                  }
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="bg-slate-900 hover:bg-slate-800">
            {saving ? "Saving..." : item ? "Save changes" : "Create item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
