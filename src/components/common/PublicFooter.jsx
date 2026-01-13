export default function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img
            src="/base25-logo.png"
            alt="base25"
            className="h-6 w-6 object-contain"
          />
          <span className="font-semibold text-slate-900">base25</span>
        </div>
        <p className="text-sm text-slate-500">
          © 2026 base25. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
