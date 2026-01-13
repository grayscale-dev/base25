import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { createPageUrl } from '@/utils';

const navLinks = [
  { label: 'Home', page: 'Home' },
  { label: 'Features', page: 'Features' },
  { label: 'About', page: 'About' },
  { label: 'Pricing', page: 'Pricing' },
];

export default function PublicHeader({ currentPage = 'Home', onRequestAccess }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/70 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to={createPageUrl('Home')} className="flex items-center gap-2">
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
              to={createPageUrl(link.page)}
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
          <Link to={createPageUrl('Workspaces')}>
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
          <Button
            size="sm"
            className="bg-slate-900 hover:bg-slate-800 text-white"
            onClick={onRequestAccess}
          >
            Request access
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
                    to={createPageUrl(link.page)}
                    onClick={() => setMenuOpen(false)}
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
                <Link to={createPageUrl('Workspaces')} onClick={() => setMenuOpen(false)}>
                  <Button variant="outline" className="w-full">Sign In</Button>
                </Link>
                <Button
                  className="bg-slate-900 hover:bg-slate-800 text-white w-full"
                  onClick={() => {
                    setMenuOpen(false);
                    onRequestAccess?.();
                  }}
                >
                  Request access
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
