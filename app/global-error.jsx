"use client";

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('Global app error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-50">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="mx-auto w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Unexpected application error</h1>
            <p className="mt-2 text-sm text-slate-600">
              Try reloading this page. If the problem persists, review the server logs.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
