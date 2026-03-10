"use client";

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Link from '@/components/common/AppLink';
import { publicRoutes } from '@/lib/public-routes';
import { startWorkspaceLogin } from '@/lib/start-workspace-login';

const navLinks = [
  { label: 'Home', page: 'home', to: publicRoutes.home },
  { label: 'Features', page: 'features', to: publicRoutes.features },
  { label: 'About', page: 'about', to: publicRoutes.about },
  { label: 'Pricing', page: 'pricing', to: publicRoutes.pricing },
];

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
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/70 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to={publicRoutes.home} className="flex items-center gap-2">
          <img
            src="/base25-logo.png"
            alt="base25"
            className="h-8 w-8 object-contain"
          />
          <span className="text-lg font-bold text-slate-900">base25</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
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

        <div className="hidden md:flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleWorkspaceAuthClick}>
            Sign In
          </Button>
          <Button
            size="sm"
            className="bg-slate-900 hover:bg-slate-800 text-white"
            onClick={handleWorkspaceAuthClick}
          >
            Get Started
          </Button>
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="flex flex-col gap-6 pt-6">
              <nav className="flex flex-col gap-3 text-sm">
                {navLinks.map((link) => (
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
              <div className="flex flex-col gap-3">
                <Button variant="outline" className="w-full" asChild>
                  <Link
                    to={publicRoutes.workspaceHub}
                    onClick={handleMobileAuthClick}
                  >
                    Sign In
                  </Link>
                </Button>
                <Button className="bg-slate-900 hover:bg-slate-800 text-white w-full" asChild>
                  <Link
                    to={publicRoutes.workspaceHub}
                    onClick={handleMobileAuthClick}
                  >
                    Get Started
                  </Link>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
