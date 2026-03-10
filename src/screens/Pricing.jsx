import { ShieldCheck } from "lucide-react";
import PublicPageLayout from "@/components/common/PublicPageLayout";
import { MarketingCtaBanner, MarketingHeroActions } from "@/components/common/PublicMarketingBlocks";
import { publicRoutes } from "@/lib/public-routes";

const SERVICES = ["Feedback", "Roadmap", "Changelog"];
const SERVICE_PRICE = 25;

export default function Pricing() {
  return (
    <PublicPageLayout currentPage="pricing" mainClassName="relative">
        <section className="px-6 py-16">
          <div className="mx-auto max-w-5xl space-y-6 text-center">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.2em]">
              Pricing
            </p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Only pay for the{" "}
              <span className="bg-gradient-to-r from-amber-500 to-cyan-500 bg-clip-text text-transparent">
                services you need
              </span>
              .
            </h1>
            <p className="mx-auto max-w-3xl text-lg text-slate-600 md:text-xl">
              Flat pricing. No usage fees. Each enabled service is billed monthly
              at a fixed rate.
            </p>

            <MarketingHeroActions className="flex flex-wrap items-center justify-center gap-4 pt-4" />
          </div>
        </section>

        <section className="px-6 pb-16">
          <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-slate-900">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
              <h2 className="text-2xl font-semibold">Flat service pricing</h2>
            </div>
            <p className="mt-3 text-slate-600">
              After the 7-day trial, each enabled service is ${SERVICE_PRICE} per
              month.
            </p>
            <div className="mt-6 grid gap-4">
              {SERVICES.map((service) => (
                <div
                  key={service}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <span className="font-medium">{service}</span>
                  <span className="text-sm text-slate-500">
                    ${SERVICE_PRICE} / month
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-20">
          <MarketingCtaBanner
            title="Start in minutes"
            description="Create your workspace and begin collecting product feedback today."
            primaryTo={publicRoutes.workspaceHub}
            secondaryTo={publicRoutes.workspaceHub}
          />
        </section>
    </PublicPageLayout>
  );
}
