import { cn } from "@/lib/utils";
import PublicHeader from "@/components/common/PublicHeader";
import PublicFooter from "@/components/common/PublicFooter";

const PUBLIC_BRAND = "#0f172a";

export default function PublicPageLayout({
  currentPage,
  children,
  mainClassName,
}) {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-900"
      style={{
        "--workspace-brand": PUBLIC_BRAND,
        "--workspace-brand-soft": "rgba(15, 23, 42, 0.12)",
        "--workspace-brand-soft-strong": "rgba(15, 23, 42, 0.22)",
        "--workspace-brand-fg": PUBLIC_BRAND,
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.20),rgba(248,250,252,0.12)_42%,transparent_72%)]" />
        <div className="absolute -left-32 top-24 h-[34rem] w-[34rem] rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute -right-28 top-8 h-[28rem] w-[28rem] rounded-full bg-sky-200/30 blur-3xl" />
      </div>

      <PublicHeader currentPage={currentPage} />

      <main className={cn("relative z-0", mainClassName)}>
        <div className="relative z-10">{children}</div>
      </main>

      <PublicFooter />
    </div>
  );
}
