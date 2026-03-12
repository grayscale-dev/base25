"use client";

import Link from "@/components/common/AppLink";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { publicRoutes } from "@/lib/public-routes";
import { startWorkspaceLogin } from "@/lib/start-workspace-login";
import { cn } from "@/lib/utils";

function isWorkspaceHubRoute(route) {
  return String(route || "") === publicRoutes.workspaceHub;
}

async function handleRouteAction(event, route) {
  if (!isWorkspaceHubRoute(route)) return;
  event?.preventDefault?.();
  await startWorkspaceLogin();
}

export function MarketingHeroActions({
  className,
  primaryLabel = "Start for $30/month",
  primaryTo = publicRoutes.workspaceHub,
  secondaryLabel = "See how it works",
  secondaryTo = publicRoutes.features,
}) {
  const primaryIsAuth = isWorkspaceHubRoute(primaryTo);
  const secondaryIsAuth = isWorkspaceHubRoute(secondaryTo);

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3 pt-4", className)}>
      {primaryIsAuth ? (
        <Button
          size="lg"
          className="bg-slate-900 text-white hover:bg-slate-800"
          onClick={(event) => {
            void handleRouteAction(event, primaryTo);
          }}
        >
          {primaryLabel}
        </Button>
      ) : (
        <Button size="lg" className="bg-slate-900 text-white hover:bg-slate-800" asChild>
          <Link to={primaryTo}>{primaryLabel}</Link>
        </Button>
      )}
      {secondaryLabel ? (
        secondaryIsAuth ? (
          <Button
            size="lg"
            variant="outline"
            className="border-slate-300 text-slate-800 hover:bg-slate-100"
            onClick={(event) => {
              void handleRouteAction(event, secondaryTo);
            }}
          >
            {secondaryLabel}
          </Button>
        ) : (
          <Button size="lg" variant="outline" className="border-slate-300 text-slate-800 hover:bg-slate-100" asChild>
            <Link to={secondaryTo}>{secondaryLabel}</Link>
          </Button>
        )
      ) : null}
    </div>
  );
}

export function MarketingCtaBanner({
  title,
  description,
  primaryLabel = "Start for $30/month",
  primaryTo = publicRoutes.workspaceHub,
  secondaryLabel = "See pricing",
  secondaryTo = publicRoutes.pricing,
}) {
  const primaryIsAuth = isWorkspaceHubRoute(primaryTo);
  const secondaryIsAuth = isWorkspaceHubRoute(secondaryTo);

  return (
    <section className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-300/70 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-900 px-6 py-10 text-white shadow-xl md:px-10 md:py-12">
      <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-12 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
          <p className="mt-2 text-slate-200">{description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {primaryIsAuth ? (
            <Button
              className="bg-white text-slate-900 hover:bg-slate-100"
              onClick={(event) => {
                void handleRouteAction(event, primaryTo);
              }}
            >
              {primaryLabel}
            </Button>
          ) : (
            <Button className="bg-white text-slate-900 hover:bg-slate-100" asChild>
              <Link to={primaryTo}>{primaryLabel}</Link>
            </Button>
          )}

          {secondaryLabel ? (
            secondaryIsAuth ? (
              <Button
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10"
                onClick={(event) => {
                  void handleRouteAction(event, secondaryTo);
                }}
              >
                {secondaryLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10" asChild>
                <Link to={secondaryTo}>
                  {secondaryLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}
