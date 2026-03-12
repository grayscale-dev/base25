import { CheckCircle2, Clock3, MessageSquareText, ShieldCheck, SquareKanban } from "lucide-react";
import PublicPageLayout from "@/components/common/PublicPageLayout";
import { MarketingCtaBanner, MarketingHeroActions } from "@/components/common/PublicMarketingBlocks";
import {
  FaqGrid,
  PlanCard,
  SectionHeading,
  SectionShell,
} from "@/components/common/PublicMarketingPrimitives";
import { publicRoutes } from "@/lib/public-routes";

const included = [
  "Feedback collection and organization",
  "Roadmap visibility and prioritization workflows",
  "Changelog publishing to close the customer loop",
  "Role-based collaboration for software teams",
  "One workspace model with startup-friendly simplicity",
];

const objections = [
  {
    icon: Clock3,
    title: "How long does setup take?",
    detail: "Most teams can launch quickly and start collecting feedback the same day.",
  },
  {
    icon: ShieldCheck,
    title: "Is there a hidden pricing catch?",
    detail: "No. Base25 is one plan at $30/month with no add-on maze.",
  },
  {
    icon: SquareKanban,
    title: "Does it include roadmap and changelog too?",
    detail: "Yes. Feedback, roadmap, and changelog are all part of the same plan.",
  },
];

const pricingFaqs = [
  {
    question: "Who should choose Base25?",
    answer:
      "Base25 is ideal for startups and small software teams that want focused feedback operations without enterprise overhead.",
  },
  {
    question: "Is pricing really flat?",
    answer:
      "Yes. One plan at $30/month. No tiers, no per-module pricing, and no surprise add-ons.",
  },
  {
    question: "Can we still collect customer feedback publicly?",
    answer:
      "Yes. Base25 is built to help teams collect feedback and keep customers informed through roadmap and changelog updates.",
  },
  {
    question: "Do we need multiple tools with this plan?",
    answer:
      "No. Base25 combines feedback, roadmap, and changelog in one product to reduce tool sprawl.",
  },
];

export default function Pricing() {
  return (
    <PublicPageLayout currentPage="pricing">
      <SectionShell className="pt-16 pb-14">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Pricing
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl">
            One clear plan for startup product teams.
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            No modular pricing. No add-on confusion. Base25 is one flat plan at $30/month.
          </p>
          <MarketingHeroActions
            primaryLabel="Start for $30/month"
            secondaryLabel="Explore features"
            secondaryTo={publicRoutes.features}
          />
        </div>
      </SectionShell>

      <SectionShell className="pb-14">
        <div className="mx-auto max-w-3xl">
          <PlanCard
            bullets={included}
            primaryLabel="Get Started"
            primaryTo={publicRoutes.workspaceHub}
            secondaryLabel="See features"
            secondaryTo={publicRoutes.features}
          />
        </div>
      </SectionShell>

      <SectionShell className="pb-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeading
            eyebrow="What You Get"
            title="Everything needed to close the customer loop"
            description="A focused toolset that keeps your team aligned from idea intake to shipped updates."
          />
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {included.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
              >
                <span className="mt-0.5 rounded-full bg-emerald-100 p-1 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <MessageSquareText className="h-4 w-4" />
              No pricing games
            </div>
            <p className="mt-2">
              You get the full feedback, roadmap, and changelog workflow in one predictable monthly plan.
            </p>
          </div>
        </div>
      </SectionShell>

      <SectionShell className="pb-14">
        <SectionHeading
          eyebrow="Decision Support"
          title="Answering common buying objections"
          description="The fastest way to evaluate if Base25 is the right fit."
          align="center"
        />
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {objections.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span className="inline-flex rounded-xl bg-slate-100 p-2">
                  <Icon className="h-4 w-4 text-slate-800" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
              </article>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell className="pb-14">
        <SectionHeading
          eyebrow="Pricing FAQ"
          title="Short answers for fast decisions"
          description="If your team wants simplicity and clarity, Base25 should feel straightforward."
        />
        <div className="mt-6">
          <FaqGrid items={pricingFaqs} />
        </div>
      </SectionShell>

      <SectionShell className="pb-20">
        <MarketingCtaBanner
          title="Ready to simplify your product feedback loop?"
          description="Start with one plan, one workspace, and one clear process for $30/month."
          primaryLabel="Get Started"
          primaryTo={publicRoutes.workspaceHub}
          secondaryLabel="Back to home"
          secondaryTo={publicRoutes.home}
        />
      </SectionShell>
    </PublicPageLayout>
  );
}

