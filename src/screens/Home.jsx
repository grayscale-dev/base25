import {
  ArrowRight,
  Clock3,
  Gauge,
  MapPinned,
  Megaphone,
  MessageSquareText,
  SplitSquareVertical,
  SquareKanban,
  Wallet,
  Wrench,
} from "lucide-react";
import Link from "@/components/common/AppLink";
import PublicPageLayout from "@/components/common/PublicPageLayout";
import {
  MarketingCtaBanner,
  MarketingHeroActions,
} from "@/components/common/PublicMarketingBlocks";
import {
  ComparisonRows,
  FaqGrid,
  PlanCard,
  SectionHeading,
  SectionShell,
} from "@/components/common/PublicMarketingPrimitives";
import { publicRoutes } from "@/lib/public-routes";

const painPoints = [
  {
    title: "Feedback is scattered",
    description:
      "Requests get buried in Slack threads, support tickets, and random docs.",
  },
  {
    title: "Priorities are hard to explain",
    description:
      "Teams and customers cannot see what is planned, what is next, and why.",
  },
  {
    title: "Shipped work is invisible",
    description:
      "Features ship, but users never hear about them and momentum gets lost.",
  },
];

const pillars = [
  {
    icon: MessageSquareText,
    title: "Feedback",
    value: "Centralize requests and keep signal high.",
    description:
      "Capture customer input in one place, organize it clearly, and move ideas forward with confidence.",
    image: "/feedback-page.png",
    to: publicRoutes.feedback,
  },
  {
    icon: SquareKanban,
    title: "Roadmap",
    value: "Share direction without the chaos.",
    description:
      "Give your team and customers visibility into what is planned, in progress, and done.",
    image: "/roadmap.png",
    to: publicRoutes.roadmap,
  },
  {
    icon: Megaphone,
    title: "Changelog",
    value: "Close the loop after you ship.",
    description:
      "Publish updates customers can actually follow and show clear product momentum.",
    image: "/changelog.png",
    to: publicRoutes.changelog,
  },
];

const whyBase25 = [
  {
    icon: Wallet,
    title: "One flat plan",
    description: "$30/month for the full product loop. No feature gating games.",
  },
  {
    icon: Gauge,
    title: "Built for speed",
    description: "Set up quickly and keep your team moving without admin overhead.",
  },
  {
    icon: SplitSquareVertical,
    title: "One source of truth",
    description: "Feedback, priorities, and releases stay connected in one workspace.",
  },
  {
    icon: Wrench,
    title: "Focused product scope",
    description: "Everything you need for modern startup product communication.",
  },
];

const comparisonRows = [
  {
    label: "Pricing model",
    base25: "One flat $30/month plan",
    alternatives: "Tiered plans and add-ons",
  },
  {
    label: "Setup complexity",
    base25: "Fast setup for startup teams",
    alternatives: "Heavier onboarding and configuration",
  },
  {
    label: "Core workflow coverage",
    base25: "Feedback + roadmap + changelog in one product",
    alternatives: "Fragmented or enterprise-oriented workflows",
  },
  {
    label: "Best fit",
    base25: "Founders and small product teams",
    alternatives: "Larger organizations with broader process overhead",
  },
];

const faqs = [
  {
    question: "Who is Base25 for?",
    answer:
      "Base25 is for startup founders, indie hackers, and software teams that want a simple product feedback loop without enterprise complexity.",
  },
  {
    question: "Does Base25 include feedback, roadmap, and changelog?",
    answer:
      "Yes. Base25 is built around these three pillars so your team can collect input, communicate priorities, and publish updates in one place.",
  },
  {
    question: "Is pricing really flat?",
    answer:
      "Yes. Base25 is one plan at $30/month. No modular pricing or add-on confusion.",
  },
  {
    question: "Can customers submit feedback?",
    answer:
      "Yes. Teams can collect feedback and use it to drive roadmap and changelog communication.",
  },
  {
    question: "Can we share a public roadmap?",
    answer:
      "Yes. Base25 supports roadmap visibility so customers can follow progress and priorities.",
  },
  {
    question: "How long does setup take?",
    answer:
      "Most teams can set up their workspace quickly and start collecting feedback the same day.",
  },
];

export default function Home() {
  return (
    <PublicPageLayout currentPage="home">
      <SectionShell className="pt-16 pb-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Feedback hub for software teams
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">
              Collect feedback, share your roadmap, and publish your changelog in one simple workspace.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              Base25 is the lightweight alternative to bloated product tools. Keep your team and customers aligned for one flat price: $30/month.
            </p>
            <MarketingHeroActions
              className="justify-start"
              primaryLabel="Start for $30/month"
              secondaryLabel="See how it works"
              secondaryTo={publicRoutes.features}
            />
            <div className="mt-7 flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-slate-800" />
                Feedback
              </div>
              <div className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-slate-800" />
                Roadmap
              </div>
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-slate-800" />
                Changelog
              </div>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-slate-800" />
                Flat $30/month
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_70px_rgba(15,23,42,0.1)]">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <img
                src="/roadmap.png"
                alt="Base25 feedback workspace preview"
                className="h-full w-full rounded-xl border border-slate-200 object-cover"
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Unified loop
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Every feature request can move from idea to shipped update in one flow.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Startup fit
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Built for small product teams that want clarity, not extra process.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell className="pb-14">
        <SectionHeading
          eyebrow="The Problem"
          title="Most feedback loops break in predictable ways"
          description="When requests are scattered and updates are inconsistent, teams lose clarity and customers lose confidence."
          align="center"
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {painPoints.map((point) => (
            <article
              key={point.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900">{point.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{point.description}</p>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell className="pb-14">
        <div className="rounded-3xl border border-slate-200 bg-slate-900 p-8 text-white shadow-xl">
          <SectionHeading
            eyebrow="The Solution"
            title="Run one connected product communication loop"
            description="Capture requests, prioritize visibly, and publish updates customers can follow."
            className="text-white [&_h2]:text-white [&_p]:text-slate-300 [&_p:first-child]:text-slate-400"
          />
          <div className="mt-7 grid gap-4 md:grid-cols-4">
            {[
              "Collect customer feedback in one inbox",
              "Prioritize and move work into roadmap status",
              "Ship and publish updates in changelog",
              "Keep customers aligned without extra tools",
            ].map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Step {index + 1}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-100">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell className="pb-14">
        <SectionHeading
          eyebrow="Core Pillars"
          title="Everything revolves around three essentials"
          description="No bloat. Just the pieces software teams need to close the product feedback loop."
          align="center"
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {pillars.map((pillar) => {
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
                <p className="mt-4 text-sm font-medium text-slate-900">{pillar.value}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{pillar.description}</p>
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <img
                    src={pillar.image}
                    alt={`${pillar.title} view`}
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

      <SectionShell id="why-base25" className="pb-14">
        <SectionHeading
          eyebrow="Why Base25"
          title="The practical choice for startup product teams"
          description="Base25 stays focused on outcomes: clear prioritization, faster communication, and a price that is easy to justify."
          align="center"
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {whyBase25.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span className="inline-flex rounded-xl bg-slate-100 p-2">
                  <Icon className="h-4 w-4 text-slate-800" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </article>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell id="pricing" className="pb-14">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple enough to decide in one meeting"
          description="You should not need a spreadsheet to choose your feedback tool."
          align="center"
        />
        <div className="mx-auto mt-8 max-w-3xl">
          <PlanCard
            bullets={[
              "Feedback management for your workspace",
              "Roadmap planning and visibility",
              "Changelog publishing for shipped updates",
              "Role-based collaboration for your team",
              "No confusing tiers or add-on pricing",
            ]}
          />
        </div>
      </SectionShell>

      <SectionShell id="comparison" className="pb-14">
        <SectionHeading
          eyebrow="Switching"
          title="Why teams pick Base25 over heavier alternatives"
          description="If you want a focused, affordable feedback loop, Base25 is often the better fit."
        />
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-2 px-1 pb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[1.4fr_1fr_1fr]">
            <p>Category</p>
            <p>Base25</p>
            <p>Typical alternatives</p>
          </div>
          <ComparisonRows rows={comparisonRows} />
        </div>
      </SectionShell>

      <SectionShell id="faq" className="pb-14">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions teams ask before switching"
          description="Clear answers for founders and product teams comparing tools."
        />
        <div className="mt-6">
          <FaqGrid items={faqs} />
        </div>
      </SectionShell>

      <SectionShell className="pb-20">
        <MarketingCtaBanner
          title="Ship with a tighter customer loop"
          description="Use one workspace for feedback, roadmap, and changelog. Start today for $30/month."
          primaryLabel="Get Started"
          primaryTo={publicRoutes.workspaceHub}
          secondaryLabel="View pricing"
          secondaryTo={publicRoutes.pricing}
        />
      </SectionShell>

      <SectionShell className="pb-6">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 text-xs text-slate-500">
          <Clock3 className="h-3.5 w-3.5" />
          <span>Designed for software teams that value clarity over complexity.</span>
        </div>
      </SectionShell>
    </PublicPageLayout>
  );
}
