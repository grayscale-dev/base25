"use client";

import Link from "@/components/common/AppLink";
import { Button } from "@/components/ui/button";
import { publicRoutes } from "@/lib/public-routes";
import { ArrowRight } from "lucide-react";
import { startWorkspaceLogin } from "@/lib/start-workspace-login";

export function MarketingHeroActions({ className }) {
  const handleAuthClick = async (event) => {
    event?.preventDefault?.();
    await startWorkspaceLogin();
  };

  return (
    <div className={className || "flex flex-wrap items-center justify-center gap-4 pt-2"}>
      <Button
        size="lg"
        className="bg-slate-900 hover:bg-slate-800 text-white"
        onClick={handleAuthClick}
      >
        Get Started
      </Button>
      <Link
        to={publicRoutes.workspaceHub}
        onClick={handleAuthClick}
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        Have access? Sign in
      </Link>
    </div>
  );
}

export function MarketingCtaBanner({
  title,
  description,
  primaryLabel = "Get Started",
  primaryTo = publicRoutes.workspaceHub,
  secondaryLabel = "Sign in",
  secondaryTo = publicRoutes.workspaceHub,
  primaryVariant = "light",
}) {
  const primaryClassName =
    primaryVariant === "light"
      ? "bg-white text-slate-900 hover:bg-slate-100"
      : "bg-slate-900 text-white hover:bg-slate-800";

  const primaryIsAuth = primaryTo === publicRoutes.workspaceHub;
  const secondaryIsAuth = secondaryTo === publicRoutes.workspaceHub;
  const handleAuthClick = async (event) => {
    event?.preventDefault?.();
    await startWorkspaceLogin();
  };

  return (
    <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-900/80 p-10 text-white shadow-xl">
      <div className="absolute -right-24 -top-16 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="absolute -bottom-20 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold">{title}</h2>
          <p className="mt-2 max-w-2xl text-slate-200">{description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {primaryIsAuth ? (
            <Button className={primaryClassName} onClick={handleAuthClick}>
              {primaryLabel}
              {primaryLabel.toLowerCase().includes("pricing") ? (
                <ArrowRight className="ml-2 h-5 w-5" />
              ) : null}
            </Button>
          ) : (
            <Button className={primaryClassName} asChild>
              <Link to={primaryTo}>
                {primaryLabel}
                {primaryLabel.toLowerCase().includes("pricing") ? (
                  <ArrowRight className="ml-2 h-5 w-5" />
                ) : null}
              </Link>
            </Button>
          )}
          {secondaryIsAuth ? (
            <Button
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
              onClick={handleAuthClick}
            >
              {secondaryLabel}
            </Button>
          ) : (
            <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" asChild>
              <Link to={secondaryTo}>{secondaryLabel}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
