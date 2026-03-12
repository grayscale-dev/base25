import { Bell, Loader2 } from "lucide-react";
import Badge from "@/components/common/Badge";
import RelativeDate from "@/components/common/RelativeDate";
import AssigneeDisplay from "@/screens/items/AssigneeDisplay";
import { getGroupLabel, getPriorityColor, getPriorityLabel } from "@/lib/item-groups";
import { isAdminRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

function toMatchLabel(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveAssignee(item, assigneeDirectoryById) {
  if (item?.assignee) {
    return item.assignee;
  }
  if (!item?.assigned_to || !assigneeDirectoryById?.get) {
    return null;
  }
  const member = assigneeDirectoryById.get(String(item.assigned_to));
  if (!member) return null;
  return {
    id: member.user_id,
    name: member.display_name || member.email || "Member",
    profile_photo_url: member.profile_photo_url || null,
  };
}

function resolveDescription(item) {
  const matchPreview = String(item?.match_preview || "").trim();
  if (matchPreview) return matchPreview;
  return String(item?.description || "").trim() || "No description provided.";
}

export default function WorkspaceItemCard({
  item,
  role = "contributor",
  isPublicAccess = false,
  onOpen,
  onToggleWatch,
  watchToggleDisabled = false,
  isOpening = false,
  assigneeDirectoryById = null,
  timestamp = null,
  timestampLabel = "Updated",
  contextText = "",
  matchContext = [],
}) {
  if (!item) return null;

  const groupLabel = item.group_label || getGroupLabel(item.group_key, String(item.group_key || "Item"));
  const statusLabel = item.status_label || item.status_key || "Unknown";
  const statusValue = `${groupLabel} • ${statusLabel}`;
  const typeLabel = item.item_type_label || item.item_type?.label || "No Type";
  const priorityKey = String(item.metadata?.priority || "not_set");
  const priorityLabel = getPriorityLabel(priorityKey);
  const priorityColor = getPriorityColor(priorityKey);
  const assignee = resolveAssignee(item, assigneeDirectoryById);
  const showAssignee = isAdminRole(role) && !isPublicAccess;
  const matchedIn = Array.isArray(matchContext) ? matchContext.filter(Boolean) : [];
  const isWatched = Boolean(item.watched);
  const canToggleWatch = typeof onToggleWatch === "function" && !isPublicAccess;
  const resolvedTimestamp =
    timestamp ||
    item.updated_date ||
    item.updated_at ||
    item.created_date ||
    item.created_at;

  const handleOpen = () => {
    if (typeof onOpen !== "function") return;
    onOpen(item);
  };

  const handleCardClick = (event) => {
    if (event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-card-action="watch-toggle"]')) {
      return;
    }
    handleOpen();
  };

  return (
    <article
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-brand)]/40"
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleOpen();
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="line-clamp-2 text-lg font-semibold text-slate-900">{item.title}</h3>
          {contextText ? <p className="line-clamp-1 text-xs text-slate-500">{contextText}</p> : null}
        </div>
        <div className="flex max-w-[55%] shrink-0 flex-wrap items-start justify-end gap-2">
          <Badge
            variant="outline"
            className="border-0 text-white"
            style={{ backgroundColor: item.group_color || "#0F172A" }}
          >
            {statusValue}
          </Badge>
          <Badge variant="outline">{typeLabel}</Badge>
          <Badge
            variant="outline"
            className="border"
            style={{ borderColor: priorityColor, color: priorityColor }}
          >
            {priorityLabel}
          </Badge>
          {showAssignee ? (
            <Badge variant="outline">
              <AssigneeDisplay
                assignee={assignee}
                fallback="Unassigned"
                sizeClassName="h-5 w-5"
                textClassName="text-xs text-slate-700"
              />
            </Badge>
          ) : null}
          {isOpening ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          {canToggleWatch ? (
            <button
              type="button"
              data-card-action="watch-toggle"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleWatch(item);
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
              disabled={watchToggleDisabled}
              aria-label={isWatched ? "Disable alerts for item" : "Enable alerts for item"}
              title={isWatched ? "Disable alerts" : "Enable alerts"}
            >
              <Bell
                className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  isWatched ? "fill-amber-400 text-amber-500" : "text-slate-400"
                )}
              />
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{resolveDescription(item)}</p>

      {matchedIn.length > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          Matched in: {matchedIn.map(toMatchLabel).join(", ")}
        </p>
      ) : null}

      <div className="mt-3 text-xs text-slate-500">
        {timestampLabel} <RelativeDate value={resolvedTimestamp} />
      </div>
    </article>
  );
}
