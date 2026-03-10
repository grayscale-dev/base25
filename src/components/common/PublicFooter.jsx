import Link from "@/components/common/AppLink";
import { publicRoutes } from "@/lib/public-routes";

export default function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <img
            src="/base25-logo.png"
            alt="base25"
            className="h-6 w-6 object-contain"
          />
          <span className="font-semibold text-slate-900">base25</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
          <Link to={publicRoutes.home} className="hover:text-slate-900">
            Home
          </Link>
          <Link to={publicRoutes.features} className="hover:text-slate-900">
            Features
          </Link>
          <Link to={publicRoutes.about} className="hover:text-slate-900">
            About
          </Link>
          <Link to={publicRoutes.pricing} className="hover:text-slate-900">
            Pricing
          </Link>
        </nav>
        <p className="text-sm text-slate-500">
          © 2026 base25. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
