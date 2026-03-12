import { ArrowRight, GitBranch, MessageSquareText, Rocket, SquareKanban } from "lucide-react";
import Link from "@/components/common/AppLink";
import PublicPageLayout from "@/components/common/PublicPageLayout";
import { MarketingCtaBanner, MarketingHeroActions } from "@/components/common/PublicMarketingBlocks";
import {
  SectionHeading,
  SectionShell,
  StatGrid,
} from "@/components/common/PublicMarketingPrimitives";
import { publicRoutes } from "@/lib/public-routes";

const featurePillars = [
  {
    icon: MessageSquareText,
    title: "Feedback",
    summary: "Collect and organize customer input in one place.",
    value: "Less noise, clearer signal for what to build next.",
    to: publicRoutes.feedback,
    image: "/feedback-page.png",
  },
  {
    icon: SquareKanban,
    title: "Roadmap",
    summary: "Share priorities and progress with confidence.",
    value: "Internal teams and customers stay aligned on direction.",
    to: publicRoutes.roadmap,
    image: "/roadmap.png",
  },
  {
    icon: Rocket,
    title: "Changelog",
    summary: "Publish product updates customers can follow.",
    value: "Every release reinforces product momentum and trust.",
    to: publicRoutes.changelog,
    image: "/changelog.png",
  },
];

const workflowStats = [
  { value: "1 inbox", label: "for product feedback across channels" },
  { value: "1 board", label: "to show priorities and progress" },
  { value: "1 feed", label: "to announce shipped updates" },
];

const workflowSteps = [
  {
    title: "Capture demand",
    detail:
      "Collect ideas and requests as they come in, then keep them grouped in one shared view.",
  },
  {
    title: "Prioritize transparently",
    detail:
      "Move the strongest signals into roadmap work so teams and customers can see momentum.",
  },
  {
    title: "Close the loop",
    detail:
      "Publish changelog updates as work ships so customers stay informed and engaged.",
  },
];

export default function Features() {
  return (
    <PublicPageLayout currentPage="features">
      <SectionShell className="pt-16 pb-14">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Features
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">
            Everything your team needs to run a clean product feedback loop.
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            Base25 keeps feedback, roadmap, and changelog connected so decisions stay clear and customers stay informed.
          </p>
          <MarketingHeroActions
            primaryLabel="Get Started"
            secondaryLabel="See pricing"
            secondaryTo={publicRoutes.pricing}
          />
        </div>
      </SectionShell>

      <SectionShell className="pb-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <SectionHeading
            eyebrow="Outcomes"
            title="Built for execution, not process overhead"
            description="Base25 gives startup teams the right amount of structure without slowing product velocity."
            align="center"
          />
          <div className="mt-7">
            <StatGrid stats={workflowStats} />
          </div>
        </div>
      </SectionShell>

      <SectionShell className="pb-14">
        <SectionHeading
          eyebrow="Three Pillars"
          title="One focused product system"
          description="Each pillar works alone, but they are most valuable when used together."
          align="center"
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {featurePillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.title}
                className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-slate-100 p-2">
                    <Icon className="h-4 w-4 text-slate-800" />
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900">{pillar.title}</h3>
                </div>
                <p className="mt-4 text-sm text-slate-600">{pillar.summary}</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{pillar.value}</p>
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <img
                    src={pillar.image}
                    alt={`${pillar.title} preview`}
                    className="h-40 w-full object-cover"
                  />
                </div>
                <Link
                  to={pillar.to}
                  className="mt-4 inline-flex items-center text-sm font-medium text-slate-900 hover:text-slate-700"
                >
                  Explore {pillar.title}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell id="workflow" className="pb-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeading
            eyebrow="How It Works"
            title="A lightweight workflow your team can actually maintain"
            description="Set up once, then keep iterating with a clear cadence."
          />
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Step {index + 1}
                </p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.detail}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
            <GitBranch className="h-4 w-4 text-slate-800" />
            One flat plan at $30/month across the full workflow.
          </div>
        </div>
      </SectionShell>

      <SectionShell className="pb-20">
        <MarketingCtaBanner
          title="See why teams switch to Base25"
          description="A simpler, more affordable way to run feedback, roadmap, and changelog together."
          primaryLabel="Start for $30/month"
          primaryTo={publicRoutes.workspaceHub}
          secondaryLabel="View pricing"
          secondaryTo={publicRoutes.pricing}
        />
      </SectionShell>
    </PublicPageLayout>
  );
}
