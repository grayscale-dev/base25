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
import AssigneeDisplay from "./AssigneeDisplay";
import ItemThreadPanel from "./ItemThreadPanel";
import { ITEM_GROUP_KEYS, getGroupLabel, getPriorityColor, getPriorityLabel } from "@/lib/item-groups";
import { cn } from "@/lib/utils";

const PRIORITY_OPTIONS = ["low", "medium", "high", "critical", "not_set"];

function draftFromItem(item) {
  if (!item) return null;
  return {
    id: item.id,
    group_key: item.group_key,
    status_id: item.status_id,
    item_type_id: item.item_type_id || "",
    assigned_to: item.assigned_to || null,
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
  return String(targetItem?.item_type_id || "");
}

function getItemPriorityValue(targetItem) {
  return String(targetItem?.metadata?.priority || "not_set");
}

export default function ItemDetailPanel({
  controller,
  item,
  isAdmin,
  showGroupContext = true,
}) {
  const [draft, setDraft] = useState(draftFromItem(item));

  useEffect(() => {
    setDraft(draftFromItem(item));
  }, [item?.id, item?.updated_at, item?.updated_date]);

  const statusLabelById = useMemo(() => {
    const map = new Map();
    controller.statuses.forEach((status) => {
      if (!map.has(status.id)) {
        map.set(status.id, status.label);
      }
    });
    return map;
  }, [controller.statuses]);

  const getStatusLabel = (targetItem) =>
    controller.statusById.get(targetItem.status_id)?.label ||
    targetItem.status_label ||
    statusLabelById.get(targetItem.status_id) ||
    targetItem.status_key ||
    "Unknown";

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

  const getGroupColor = (groupKey) => {
    return (
      controller.groups.find((group) => group.group_key === groupKey)?.color_hex ||
      item?.group_color ||
      "#0F172A"
    );
  };

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
        status_id: nextDraft.status_id,
        item_type_id: nextDraft.item_type_id,
        assigned_to: nextDraft.assigned_to,
        title: nextDraft.title.trim(),
        description: item.description || "",
        metadata: nextDraft.metadata || item.metadata || {},
        visibility: nextDraft.visibility || "public",
      },
      previousItem: {
        ...item,
        group_key: draft.group_key,
        status_id: draft.status_id,
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

  const handleStatusSelection = async (nextStatusId) => {
    if (!draft || !nextStatusId) return;
    if (nextStatusId === draft.status_id) return;
    const nextStatus = controller.statusById.get(nextStatusId);
    if (!nextStatus) return;
    await saveDetails({
      status_id: nextStatusId,
      group_key: nextStatus.group_key,
    });
  };

  const handleTypeSelection = async (nextType) => {
    if (!draft) return;
    const currentType = getItemTypeValue(draft);
    if (nextType === currentType) return;
    await saveDetails({ item_type_id: nextType });
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

  const handleAssigneeSelection = async (nextAssigneeId) => {
    if (!draft) return;
    const normalizedAssignee = nextAssigneeId === "unassigned" ? null : nextAssigneeId;
    if (normalizedAssignee === draft.assigned_to) return;
    await saveDetails({ assigned_to: normalizedAssignee });
  };

  if (!item) return null;

  const currentItem = draft || item;
  const combinedStatusLabel = showGroupContext
    ? `${getGroupDisplayLabel(currentItem.group_key)} • ${getStatusLabel(currentItem)}`
    : getStatusLabel(currentItem);
  const itemTypeValue = getItemTypeValue(currentItem);
  const itemPriorityValue = getItemPriorityValue(currentItem);
  const itemTypeLabel = controller.itemTypesById.get(itemTypeValue)?.label || "No Type";
  const itemPriorityLabel = getPriorityLabel(itemPriorityValue);
  const typeOptions = (controller.itemTypes || [])
    .filter((itemType) => itemType?.is_active !== false)
    .slice()
    .sort((left, right) => (left.display_order || 0) - (right.display_order || 0));

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
                <Badge
                  variant="outline"
                  className="border-0 text-white"
                  style={{ backgroundColor: getGroupColor(currentItem.group_key) }}
                >
                  {combinedStatusLabel}
                </Badge>
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
                      currentItem.status_id === status.id;
                    return (
                      <DropdownMenuItem
                        key={`${section.groupKey}:${status.id}`}
                        className={cn(
                          "w-full justify-between",
                          isCurrent && "bg-slate-100 text-slate-900"
                        )}
                        onClick={() => {
                          void handleStatusSelection(status.id);
                        }}
                      >
                        <span>{status.label || "Unnamed status"}</span>
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
          <Badge
            variant="outline"
            className="border-0 text-white"
            style={{ backgroundColor: getGroupColor(currentItem.group_key) }}
          >
            {combinedStatusLabel}
          </Badge>
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
              {typeOptions.map((optionValue) => {
                const isCurrent = itemTypeValue === optionValue.id;
                return (
                  <DropdownMenuItem
                    key={optionValue.id}
                    className={cn("w-full justify-between", isCurrent && "bg-slate-100 text-slate-900")}
                    onClick={() => {
                      void handleTypeSelection(optionValue.id);
                    }}
                  >
                    <span>{optionValue.label}</span>
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
                <Badge
                  variant="outline"
                  className="border"
                  style={{
                    borderColor: getPriorityColor(itemPriorityValue),
                    color: getPriorityColor(itemPriorityValue),
                  }}
                >
                  {itemPriorityLabel}
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {PRIORITY_OPTIONS.map((optionValue) => {
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
          <Badge
            variant="outline"
            className="border"
            style={{
              borderColor: getPriorityColor(itemPriorityValue),
              color: getPriorityColor(itemPriorityValue),
            }}
          >
            {itemPriorityLabel}
          </Badge>
        )}

        {currentItem.group_key === "feedback" && !controller.isPublicAccess ? (
          isAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full"
                  disabled={controller.savingItem}
                  aria-label="Change assignee"
                >
                  <Badge variant="outline">
                    <AssigneeDisplay
                      assignee={currentItem.assignee}
                      fallback="Unassigned"
                      sizeClassName="h-5 w-5"
                      textClassName="text-xs text-slate-700"
                    />
                  </Badge>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                <DropdownMenuItem
                  className="w-full justify-between"
                  onClick={() => {
                    void handleAssigneeSelection("unassigned");
                  }}
                >
                  <span>Unassigned</span>
                  {!currentItem.assigned_to ? <Check className="h-4 w-4 text-slate-600" /> : null}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {controller.memberDirectory.map((member) => {
                  const isCurrent = currentItem.assigned_to === member.user_id;
                  return (
                    <DropdownMenuItem
                      key={member.user_id}
                      className={cn("w-full justify-between", isCurrent && "bg-slate-100 text-slate-900")}
                      onClick={() => {
                        void handleAssigneeSelection(member.user_id);
                      }}
                    >
                      <AssigneeDisplay
                        assignee={{
                          name: member.display_name || member.email,
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
          ) : (
            <Badge variant="outline">
              <AssigneeDisplay
                assignee={currentItem.assignee}
                fallback="Unassigned"
                sizeClassName="h-5 w-5"
                textClassName="text-xs text-slate-700"
              />
            </Badge>
          )
        ) : null}

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
