"use client";

import { AlertTriangle } from "lucide-react";
import Link from "@/components/common/AppLink";

export default function WorkspaceSectionError({ error, reset }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Unable to load workspace</h1>
        <p className="mt-2 text-slate-600">
          {error?.message || "This page hit an unexpected error. Try again or return to your workspaces."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            Try again
          </button>
          <Link
            to="/workspaces"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View Workspaces
          </Link>
        </div>
      </div>
    </div>
  );
}
