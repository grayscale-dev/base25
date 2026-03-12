import Link from "@/components/common/AppLink";
import { publicRoutes } from "@/lib/public-routes";

const productLinks = [
  { label: "Features", to: publicRoutes.features },
  { label: "Pricing", to: publicRoutes.pricing },
  { label: "Feedback", to: publicRoutes.feedback },
  { label: "Roadmap", to: publicRoutes.roadmap },
  { label: "Changelog", to: publicRoutes.changelog },
];

const compareLinks = [
  { label: "Why Base25", to: "/#why-base25" },
  { label: "Switching Guide", to: "/#comparison" },
  { label: "FAQ", to: "/#faq" },
];

const companyLinks = [
  { label: "About", to: publicRoutes.about },
  { label: "Get Started", to: publicRoutes.workspaceHub },
];

const legalLinks = [
  { label: "Privacy", to: "#" },
  { label: "Terms", to: "#" },
  { label: "Security", to: "#" },
];

export default function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/95 px-6 py-14">
      <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <img
              src="/base25-logo.png"
              alt="base25"
              className="h-7 w-7 rounded-lg object-contain"
            />
            <span className="text-lg font-semibold text-slate-900">base25</span>
          </div>
          <p className="max-w-xs text-sm text-slate-600">
            The simple feedback hub for software teams. Collect feedback, ship with confidence, and keep customers in the loop.
          </p>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
            One plan: $30/month
          </p>
        </div>

        <FooterColumn title="Product" links={productLinks} />
        <FooterColumn title="Compare" links={compareLinks} />
        <FooterColumn title="Company" links={companyLinks} />
        <FooterColumn title="Legal" links={legalLinks} />
      </div>

      <div className="mx-auto mt-10 flex w-full max-w-7xl flex-col gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 base25. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <img
            src="/base25-favicon.png"
            alt="base25 favicon"
            className="h-4 w-4 object-contain opacity-70"
          />
          <span>Built for modern software teams</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      <nav className="mt-4 flex flex-col gap-2.5">
        {links.map((link) => (
          <Link
            key={`${title}-${link.label}`}
            to={link.to}
            className="text-sm text-slate-600 transition hover:text-slate-900"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
