import { cn } from "@/lib/utils";

function getInitials(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export default function AssigneeDisplay({
  assignee,
  fallback = "Unassigned",
  sizeClassName = "h-6 w-6",
  textClassName = "text-sm text-slate-700",
}) {
  if (!assignee) {
    return <span className={textClassName}>{fallback}</span>;
  }

  const name = assignee.name || fallback;
  const photoUrl = assignee.profile_photo_url || null;

  return (
    <span className="inline-flex items-center gap-2">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          className={cn("rounded-full object-cover", sizeClassName)}
        />
      ) : (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600",
            sizeClassName
          )}
          aria-hidden="true"
        >
          {getInitials(name)}
        </span>
      )}
      <span className={textClassName}>{name}</span>
    </span>
  );
}
