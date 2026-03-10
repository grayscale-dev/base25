import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PageEmptyState({
  icon: Icon = Info,
  title,
  description,
  className,
}) {
  return (
    <section className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {Icon ? (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
          <Icon className="h-5 w-5 text-slate-500" />
        </div>
      ) : null}
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-2 max-w-xl text-sm text-slate-500">{description}</p> : null}
    </section>
  );
}

