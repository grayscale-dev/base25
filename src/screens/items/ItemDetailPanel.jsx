import { Fragment, useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check } from "lucide-react";
import Badge from "@/components/common/Badge";
import ItemThreadPanel from "./ItemThreadPanel";
import { ITEM_GROUP_KEYS, getGroupLabel } from "@/lib/item-groups";
import { cn } from "@/lib/utils";

const FEEDBACK_TYPE_OPTIONS = ["feature_request", "bug", "improvement", "question"];
const CHANGELOG_TYPE_OPTIONS = ["release", "hotfix", "announcement"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];
const TYPE_LABEL_BY_VALUE = {
  feature_request: "Feature request",
  bug: "Bug",
  improvement: "Improvement",
  question: "Question",
  release: "Release",
  hotfix: "Hotfix",
  announcement: "Announcement",
  not_set: "Not set",
};
const PRIORITY_LABEL_BY_VALUE = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  not_set: "Not set",
};

function draftFromItem(item) {
  if (!item) return null;
  return {
    id: item.id,
    group_key: item.group_key,
    status_key: item.status_key,
    title: item.title || "",
    metadata: item.metadata || {},
    visibility: item.visibility || "public",
  };
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function getItemTypeValue(targetItem) {
  return String(targetItem?.metadata?.type || targetItem?.metadata?.announcement_type || "not_set");
}

function getItemPriorityValue(targetItem) {
  return String(targetItem?.metadata?.priority || "not_set");
}

function getTypeLabel(value) {
  return TYPE_LABEL_BY_VALUE[value] || String(value);
}

function getPriorityLabel(value) {
  return PRIORITY_LABEL_BY_VALUE[value] || String(value);
}

function getTypeFieldName(groupKey) {
  return groupKey === "changelog" ? "announcement_type" : "type";
}

function getTypeOptions(groupKey) {
  return groupKey === "changelog" ? CHANGELOG_TYPE_OPTIONS : FEEDBACK_TYPE_OPTIONS;
}

export default function ItemDetailPanel({
  controller,
  item,
  isAdmin,
}) {
  const [draft, setDraft] = useState(draftFromItem(item));

  useEffect(() => {
    setDraft(draftFromItem(item));
  }, [item?.id, item?.updated_at, item?.updated_date]);

  const statusLabelByKey = useMemo(() => {
    const map = new Map();
    controller.statuses.forEach((status) => {
      if (!map.has(status.status_key)) {
        map.set(status.status_key, status.label);
      }
    });
    return map;
  }, [controller.statuses]);

  const getStatusLabel = (targetItem) =>
    controller.statusesByGroup[targetItem.group_key]?.find(
      (status) => status.status_key === targetItem.status_key
    )?.label || statusLabelByKey.get(targetItem.status_key) || targetItem.status_key;

  const groupLabelByKey = useMemo(() => {
    const map = new Map();
    (controller.groups || []).forEach((group) => {
      if (!group?.group_key) return;
      map.set(
        group.group_key,
        group.display_name || getGroupLabel(group.group_key, String(group.group_key))
      );
    });
    return map;
  }, [controller.groups]);

  const getGroupDisplayLabel = (groupKey) =>
    groupLabelByKey.get(groupKey) || getGroupLabel(groupKey, String(groupKey));

  const statusSections = useMemo(() => {
    const statusesByGroup = controller.statusesByGroup || {};
    const orderedConfiguredGroupKeys = (controller.groups || [])
      .slice()
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      .map((group) => group.group_key)
      .filter(Boolean);

    const baseGroupOrder = orderedConfiguredGroupKeys.length > 0
      ? orderedConfiguredGroupKeys
      : ITEM_GROUP_KEYS;

    const additionalGroupKeys = Object.keys(statusesByGroup).filter(
      (groupKey) => !baseGroupOrder.includes(groupKey)
    );

    return [...baseGroupOrder, ...additionalGroupKeys]
      .map((groupKey) => ({
        groupKey,
        groupLabel: getGroupDisplayLabel(groupKey),
        statuses: statusesByGroup[groupKey] || [],
      }))
      .filter((section) => section.statuses.length > 0);
  }, [controller.statusesByGroup, controller.groups, groupLabelByKey]);

  const saveDetails = async (nextValues) => {
    if (!item?.id || !draft) return false;
    const nextDraft = {
      ...draft,
      ...nextValues,
    };

    if (!nextDraft.title.trim()) {
      controller.setError("Title is required.");
      return false;
    }

    const result = await controller.saveItem({
      payload: {
        id: item.id,
        group_key: nextDraft.group_key,
        status_key: nextDraft.status_key,
        title: nextDraft.title.trim(),
        description: item.description || "",
        metadata: nextDraft.metadata || item.metadata || {},
        visibility: nextDraft.visibility || "public",
      },
      previousItem: {
        ...item,
        group_key: draft.group_key,
        status_key: draft.status_key,
      },
    });

    if (!result.ok) {
      controller.setError(result.error);
      return false;
    }

    await controller.loadItemActivities(result.item || item);
    setDraft(draftFromItem(result.item || item));
    return true;
  };

  const handleStatusSelection = async (nextGroup, nextStatus) => {
    if (!draft || !nextGroup || !nextStatus) return;
    if (nextGroup === draft.group_key && nextStatus === draft.status_key) return;
    await saveDetails({
      group_key: nextGroup,
      status_key: nextStatus,
    });
  };

  const handleTypeSelection = async (nextType) => {
    if (!draft) return;
    const currentType = getItemTypeValue(draft);
    if (nextType === currentType) return;

    const typeFieldName = getTypeFieldName(draft.group_key);
    const nextMetadata = { ...(draft.metadata || {}) };
    if (nextType === "not_set") {
      delete nextMetadata[typeFieldName];
      if (typeFieldName !== "type") delete nextMetadata.type;
      if (typeFieldName !== "announcement_type") delete nextMetadata.announcement_type;
    } else {
      nextMetadata[typeFieldName] = nextType;
      if (typeFieldName === "type") delete nextMetadata.announcement_type;
      if (typeFieldName === "announcement_type") delete nextMetadata.type;
    }

    await saveDetails({ metadata: nextMetadata });
  };

  const handlePrioritySelection = async (nextPriority) => {
    if (!draft) return;
    const currentPriority = getItemPriorityValue(draft);
    if (nextPriority === currentPriority) return;

    const nextMetadata = { ...(draft.metadata || {}) };
    if (nextPriority === "not_set") {
      delete nextMetadata.priority;
    } else {
      nextMetadata.priority = nextPriority;
    }

    await saveDetails({ metadata: nextMetadata });
  };

  if (!item) return null;

  const currentItem = draft || item;
  const combinedStatusLabel = `${getGroupDisplayLabel(currentItem.group_key)} • ${getStatusLabel(currentItem)}`;
  const itemTypeValue = getItemTypeValue(currentItem);
  const itemPriorityValue = getItemPriorityValue(currentItem);
  const itemTypeLabel = getTypeLabel(itemTypeValue);
  const itemPriorityLabel = getPriorityLabel(itemPriorityValue);
  const typeOptions = getTypeOptions(currentItem.group_key);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full"
                disabled={controller.savingItem}
                aria-label="Change group and status"
              >
                <Badge variant="outline">{combinedStatusLabel}</Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72">
              {statusSections.map((section, sectionIndex) => (
                <Fragment key={section.groupKey}>
                  <DropdownMenuLabel className="px-2 pb-1 pt-2 text-xs uppercase tracking-wide text-slate-500">
                    {section.groupLabel}
                  </DropdownMenuLabel>
                  {section.statuses.map((status) => {
                    const isCurrent =
                      currentItem.group_key === section.groupKey &&
                      currentItem.status_key === status.status_key;
                    return (
                      <DropdownMenuItem
                        key={`${section.groupKey}:${status.id || status.status_key}`}
                        className={cn(
                          "w-full justify-between",
                          isCurrent && "bg-slate-100 text-slate-900"
                        )}
                        onClick={() => {
                          void handleStatusSelection(section.groupKey, status.status_key);
                        }}
                      >
                        <span>{status.label || status.status_key}</span>
                        {isCurrent ? <Check className="h-4 w-4 text-slate-600" /> : null}
                      </DropdownMenuItem>
                    );
                  })}
                  {sectionIndex < statusSections.length - 1 ? <DropdownMenuSeparator /> : null}
                </Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Badge variant="outline">{combinedStatusLabel}</Badge>
        )}

        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full"
                disabled={controller.savingItem}
                aria-label="Change item type"
              >
                <Badge variant="outline">{itemTypeLabel}</Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {[...typeOptions, "not_set"].map((optionValue) => {
                const isCurrent = itemTypeValue === optionValue;
                return (
                  <DropdownMenuItem
                    key={optionValue}
                    className={cn("w-full justify-between", isCurrent && "bg-slate-100 text-slate-900")}
                    onClick={() => {
                      void handleTypeSelection(optionValue);
                    }}
                  >
                    <span>{getTypeLabel(optionValue)}</span>
                    {isCurrent ? <Check className="h-4 w-4 text-slate-600" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Badge variant="outline">{itemTypeLabel}</Badge>
        )}

        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full"
                disabled={controller.savingItem}
                aria-label="Change item priority"
              >
                <Badge variant="outline">{itemPriorityLabel}</Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {[...PRIORITY_OPTIONS, "not_set"].map((optionValue) => {
                const isCurrent = itemPriorityValue === optionValue;
                return (
                  <DropdownMenuItem
                    key={optionValue}
                    className={cn("w-full justify-between", isCurrent && "bg-slate-100 text-slate-900")}
                    onClick={() => {
                      void handlePrioritySelection(optionValue);
                    }}
                  >
                    <span>{getPriorityLabel(optionValue)}</span>
                    {isCurrent ? <Check className="h-4 w-4 text-slate-600" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Badge variant="outline">{itemPriorityLabel}</Badge>
        )}

        <span className="text-xs text-slate-500">
          Updated{" "}
          {formatDate(
            item.updated_date || item.updated_at || item.created_date || item.created_at
          )}
        </span>
      </div>

      <ItemThreadPanel controller={controller} item={item} />
    </div>
  );
}
