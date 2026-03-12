import { Check, ChevronRight } from "lucide-react";
import Link from "@/components/common/AppLink";
import { Button } from "@/components/ui/button";
import { publicRoutes } from "@/lib/public-routes";

export function SectionShell({ id, className = "", children }) {
  return (
    <section id={id} className={`px-6 ${className}`}>
      <div className="mx-auto w-full max-w-7xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className = "",
}) {
  const isCentered = align === "center";
  return (
    <div className={`${isCentered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"} ${className}`}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function StatGrid({ stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
          <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

export function PlaceholderLogoCloud({ labels }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {labels.map((label) => (
        <div
          key={label}
          className="flex h-12 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
        >
          {label}
        </div>
      ))}
    </div>
  );
}

export function PlanCard({
  title = "Base25",
  price = "$30",
  cadence = "/month",
  subtitle = "One flat plan for feedback, roadmap, and changelog.",
  bullets,
  primaryLabel = "Start for $30/month",
  primaryTo = publicRoutes.workspaceHub,
  secondaryLabel = "See how it works",
  secondaryTo = publicRoutes.features,
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <div className="mt-4 flex items-end gap-2">
        <span className="text-5xl font-semibold tracking-tight text-slate-900">{price}</span>
        <span className="pb-1 text-base text-slate-500">{cadence}</span>
      </div>
      <p className="mt-4 text-base text-slate-600">{subtitle}</p>
      <ul className="mt-6 space-y-3">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3 text-sm text-slate-700">
            <span className="mt-0.5 rounded-full bg-emerald-100 p-1 text-emerald-700">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button className="bg-slate-900 text-white hover:bg-slate-800" asChild>
          <Link to={primaryTo}>{primaryLabel}</Link>
        </Button>
        {secondaryLabel ? (
          <Button
            variant="outline"
            className="border-slate-300 text-slate-800 hover:bg-slate-100"
            asChild
          >
            <Link to={secondaryTo}>
              {secondaryLabel}
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ComparisonRows({ rows }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {rows.map((row, index) => (
        <div
          key={row.label}
          className={`grid gap-3 px-5 py-4 text-sm md:grid-cols-[1.4fr_1fr_1fr] md:items-center ${
            index < rows.length - 1 ? "border-b border-slate-100" : ""
          }`}
        >
          <p className="font-medium text-slate-900">{row.label}</p>
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
            {row.base25}
          </p>
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-slate-600">
            {row.alternatives}
          </p>
        </div>
      ))}
    </div>
  );
}

export function FaqGrid({ items }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <article
          key={item.question}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.answer}</p>
        </article>
      ))}
    </div>
  );
}

