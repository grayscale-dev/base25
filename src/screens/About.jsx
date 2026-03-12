import { Compass, Handshake, Lightbulb, Rocket } from "lucide-react";
import PublicPageLayout from "@/components/common/PublicPageLayout";
import { MarketingCtaBanner, MarketingHeroActions } from "@/components/common/PublicMarketingBlocks";
import {
  SectionHeading,
  SectionShell,
} from "@/components/common/PublicMarketingPrimitives";
import { publicRoutes } from "@/lib/public-routes";

const principles = [
  {
    icon: Compass,
    title: "Clarity over complexity",
    description:
      "Product teams should not need enterprise process to run a healthy feedback loop.",
  },
  {
    icon: Lightbulb,
    title: "Build from real demand",
    description:
      "Feedback should shape priorities, not disappear into disconnected tools.",
  },
  {
    icon: Handshake,
    title: "Keep customers in the loop",
    description:
      "Roadmap and changelog communication should be transparent and consistent.",
  },
  {
    icon: Rocket,
    title: "Ship with momentum",
    description:
      "Simple systems let small teams move faster and communicate better.",
  },
];

export default function About() {
  return (
    <PublicPageLayout currentPage="about">
      <SectionShell className="pt-16 pb-14">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            About Base25
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl">
            Built for teams that ship software and stay close to customers.
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            Base25 was created for startup product teams that wanted one clean place to collect feedback, share roadmap direction, and publish updates.
          </p>
          <MarketingHeroActions
            primaryLabel="Get Started"
            secondaryLabel="See pricing"
            secondaryTo={publicRoutes.pricing}
          />
        </div>
      </SectionShell>

      <SectionShell className="pb-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeading
            eyebrow="Our Point of View"
            title="Most feedback tools are too heavy for startup execution"
            description="We built Base25 around a direct belief: software teams should have one simple system for feedback, roadmap, and changelog."
          />
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-600">
            <p>
              Too many teams run product communication through a patchwork of docs, chat, boards, and release notes. That creates ambiguity for both internal teams and customers.
            </p>
            <p>
              Base25 keeps the loop connected. Teams can capture input, prioritize clearly, and show what shipped without managing extra complexity.
            </p>
            <p>
              The product is intentionally focused and priced to stay accessible at a flat $30/month.
            </p>
          </div>
        </div>
      </SectionShell>

      <SectionShell className="pb-14">
        <SectionHeading
          eyebrow="Principles"
          title="What drives product decisions at Base25"
          description="The product stays opinionated so teams can move fast."
          align="center"
        />
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {principles.map((principle) => {
            const Icon = principle.icon;
            return (
              <article
                key={principle.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span className="inline-flex rounded-xl bg-slate-100 p-2">
                  <Icon className="h-4 w-4 text-slate-800" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  {principle.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {principle.description}
                </p>
              </article>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell className="pb-20">
        <MarketingCtaBanner
          title="Use the same workflow your customers can actually follow"
          description="Move from scattered requests to clear communication with one Base25 workspace."
          primaryLabel="Start for $30/month"
          primaryTo={publicRoutes.workspaceHub}
          secondaryLabel="Explore features"
          secondaryTo={publicRoutes.features}
        />
      </SectionShell>
    </PublicPageLayout>
  );
}

