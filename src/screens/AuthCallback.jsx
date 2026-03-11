"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Link from "@/components/common/AppLink";
import { supabase } from "@/lib/supabase-client";
import { publicRoutes } from "@/lib/public-routes";

function sanitizeReturnTo(rawValue) {
  if (!rawValue) return null;
  const value = String(rawValue).trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/auth/sign-in") || value.startsWith("/auth/callback")) {
    return null;
  }
  return value;
}

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState("");

  const returnTo = useMemo(
    () => sanitizeReturnTo(searchParams.get("returnTo")) || publicRoutes.workspaceHub,
    [searchParams]
  );

  useEffect(() => {
    let active = true;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const waitForSession = async (timeoutMs = 4000) => {
      const deadline = Date.now() + timeoutMs;
      while (active && Date.now() < deadline) {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;
        if (session) return session;
        await sleep(200);
      }
      return null;
    };

    const completeAuth = async () => {
      try {
        const code = searchParams.get("code");
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
          });
          if (error) throw error;
        }

        const session = await waitForSession();
        if (!session) {
          throw new Error("No active session found.");
        }

        if (!active) return;
        router.replace(returnTo);
        router.refresh();
      } catch (error) {
        console.error("Magic link callback failed:", error);
        if (!active) return;
        try {
          const session = await waitForSession(1500);
          if (session && active) {
            router.replace(returnTo);
            router.refresh();
            return;
          }
        } catch {
          // ignore secondary session check errors
        }
        if (searchParams.get("code")) {
          setErrorMessage(
            "This link could not be completed in this browser session. Request a new magic link and open it in the same browser."
          );
          return;
        }
        setErrorMessage(
          error?.message || "This sign-in link is invalid or expired. Request a new magic link."
        );
      }
    };

    void completeAuth();
    return () => {
      active = false;
    };
  }, [returnTo, router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {errorMessage ? (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-slate-900">Sign-in failed</h1>
            <p className="text-sm text-rose-600">{errorMessage}</p>
            <Link
              to={`${publicRoutes.signIn}?returnTo=${encodeURIComponent(returnTo)}`}
              className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Request a new magic link
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-slate-700">
            <Loader2 className="h-5 w-5 animate-spin" />
            Completing sign-in...
          </div>
        )}
      </div>
    </div>
  );
}
