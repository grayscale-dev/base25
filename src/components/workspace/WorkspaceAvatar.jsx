import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_STYLES = {
  sm: {
    wrapper: "h-7 w-7 rounded-md",
    icon: "h-3.5 w-3.5",
  },
  md: {
    wrapper: "h-8 w-8 rounded-lg",
    icon: "h-4 w-4",
  },
  lg: {
    wrapper: "h-12 w-12 rounded-xl",
    icon: "h-5 w-5",
  },
};

export default function WorkspaceAvatar({
  workspace,
  size = "md",
  className,
  imageClassName,
}) {
  const styles = SIZE_STYLES[size] || SIZE_STYLES.md;
  const baseClasses = cn(
    "flex shrink-0 items-center justify-center overflow-hidden",
    styles.wrapper,
    className
  );

  if (workspace?.logo_url) {
    return (
      <img
        src={workspace.logo_url}
        alt={workspace?.name || "Workspace"}
        className={cn(baseClasses, "border border-slate-200 bg-white object-contain", imageClassName)}
      />
    );
  }

  return (
    <div
      className={baseClasses}
      style={{ backgroundColor: workspace?.primary_color || "#0f172a" }}
    >
      <Folder className={cn("text-white", styles.icon)} />
    </div>
  );
}

