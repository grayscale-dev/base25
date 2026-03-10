import { cn } from "@/lib/utils";
import PublicHeader from "@/components/common/PublicHeader";
import PublicFooter from "@/components/common/PublicFooter";

export default function PublicPageLayout({
  currentPage,
  children,
  mainClassName,
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute -left-40 top-40 h-[28rem] w-[28rem] rounded-full bg-cyan-200/40 blur-3xl" />
      </div>

      <PublicHeader currentPage={currentPage} />

      <main className={cn("relative z-0 bg-[#F8FAFC]", mainClassName)}>
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="absolute -left-40 top-40 h-[28rem] w-[28rem] rounded-full bg-cyan-200/40 blur-3xl" />
        </div>
        <div className="relative z-10">{children}</div>
      </main>

      <PublicFooter />
    </div>
  );
}
