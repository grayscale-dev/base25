"use client";

import { useState } from 'react';
import { ChevronRight, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Link from '@/components/common/AppLink';
import { publicRoutes } from '@/lib/public-routes';
import { startWorkspaceLogin } from '@/lib/start-workspace-login';

const primaryLinks = [
  { label: 'Home', page: 'home', to: publicRoutes.home },
  { label: 'Features', page: 'features', to: publicRoutes.features },
  { label: 'Pricing', page: 'pricing', to: publicRoutes.pricing },
];

const secondaryLinks = [{ label: 'About', page: 'about', to: publicRoutes.about }];

export default function PublicHeader({ currentPage = 'home' }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleWorkspaceAuthClick = async (event) => {
    event?.preventDefault?.();
    await startWorkspaceLogin();
  };

  const handleMobileAuthClick = async (event) => {
    setMenuOpen(false);
    await handleWorkspaceAuthClick(event);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to={publicRoutes.home} className="flex items-center gap-2.5">
          <img
            src="/base25-logo.png"
            alt="base25"
            className="h-8 w-8 rounded-lg object-contain"
          />
          <div className="leading-none">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-slate-500">
              Base25
            </p>
            <p className="text-sm font-semibold text-slate-900">
              Feedback hub
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {primaryLinks.map((link) => (
            <Link
              key={link.page}
              to={link.to}
              className={`text-sm font-medium ${
                currentPage === link.page
                  ? 'text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {secondaryLinks.map((link) => (
            <Link
              key={link.page}
              to={link.to}
              className={`text-sm font-medium ${
                currentPage === link.page
                  ? 'text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button
            size="sm"
            className="bg-slate-900 text-white shadow-sm hover:bg-slate-800"
            onClick={handleWorkspaceAuthClick}
          >
            Get Started
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 border-l border-slate-200 bg-white px-6">
            <div className="flex flex-col gap-8 pt-8">
              <nav className="flex flex-col gap-3 text-sm">
                {[...primaryLinks, ...secondaryLinks].map((link) => (
                  <Link
                    key={link.page}
                    to={link.to}
                    onClick={() => {
                      setMenuOpen(false);
                    }}
                    className={
                      currentPage === link.page
                        ? 'font-medium text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    }
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Feedback, roadmap, and changelog in one place.
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  One flat plan at $30/month.
                </p>
                <Button className="mt-4 w-full bg-slate-900 text-white hover:bg-slate-800" onClick={handleMobileAuthClick}>
                  Get Started
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
