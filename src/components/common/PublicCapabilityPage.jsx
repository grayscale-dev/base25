import {
  SectionHeading,
  SectionShell,
  StatGrid,
} from "@/components/common/PublicMarketingPrimitives";
import {
  MarketingCtaBanner,
  MarketingHeroActions,
} from "@/components/common/PublicMarketingBlocks";
import PublicPageLayout from "@/components/common/PublicPageLayout";
import { publicRoutes } from "@/lib/public-routes";

export default function PublicCapabilityPage({
  pageKey,
  eyebrow,
  title,
  subtitle,
  imageSrc,
  imageAlt,
  whyPoints,
  workflowSteps,
  valueStats,
}) {
  return (
    <PublicPageLayout currentPage={pageKey}>
      <SectionShell className="pt-16 pb-12">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-600">{subtitle}</p>
            <MarketingHeroActions className="justify-start" />
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
            <img
              src={imageSrc}
              alt={imageAlt}
              className="h-full w-full rounded-2xl border border-slate-100 object-cover"
            />
          </div>
        </div>
      </SectionShell>

      <SectionShell className="pb-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <SectionHeading
            eyebrow={`Why ${eyebrow}`}
            title={`Why ${eyebrow.toLowerCase()} matters`}
            description="When this layer is weak, customer trust drops and product decisions slow down."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {whyPoints.map((point) => (
              <div
                key={point}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                {point}
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell className="pb-12">
        <SectionHeading
          eyebrow="How Base25 Handles It"
          title={`A simple ${eyebrow.toLowerCase()} workflow`}
          description="No complex setup. Teams can roll this out quickly and keep everyone aligned."
          align="center"
        />
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <div
              key={step}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Step {index + 1}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell className="pb-20">
        <SectionHeading
          eyebrow="Business Value"
          title="Startup-team outcomes"
          description="A focused product loop means less overhead and better communication with customers."
        />
        <div className="mt-7">
          <StatGrid stats={valueStats} />
        </div>
      </SectionShell>

      <SectionShell className="pb-20">
        <MarketingCtaBanner
          title="Run your full product loop in Base25"
          description="Feedback, roadmap, and changelog all live in one workspace with one flat $30/month plan."
          primaryLabel="Start for $30/month"
          primaryTo={publicRoutes.workspaceHub}
          secondaryLabel="See pricing"
          secondaryTo={publicRoutes.pricing}
        />
      </SectionShell>
    </PublicPageLayout>
  );
}

