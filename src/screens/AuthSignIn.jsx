"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import Link from "@/components/common/AppLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-client";
import { publicRoutes } from "@/lib/public-routes";

const RESEND_COOLDOWN_SECONDS = 60;

function sanitizeReturnTo(rawValue) {
  if (!rawValue) return null;
  const value = String(rawValue).trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/auth/sign-in") || value.startsWith("/auth/callback")) {
    return null;
  }
  return value;
}

function maskEmail(email) {
  const [local, domain] = String(email || "").split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] || ""}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function buildMagicLinkRedirect(returnTo) {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}

export default function AuthSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const returnTo = useMemo(
    () => sanitizeReturnTo(searchParams.get("returnTo")) || publicRoutes.workspaceHub,
    [searchParams]
  );

  useEffect(() => {
    let intervalId = null;
    if (cooldown > 0) {
      intervalId = setInterval(() => {
        setCooldown((current) => (current <= 1 ? 0 : current - 1));
      }, 1000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [cooldown]);

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active || !session) return;
      router.replace(returnTo);
      router.refresh();
    };

    void checkSession();
    return () => {
      active = false;
    };
  }, [returnTo, router]);

  const sendMagicLink = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage("Enter your email to continue.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: buildMagicLinkRedirect(returnTo),
        },
      });
      if (error) throw error;

      setEmail(normalizedEmail);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage(`Magic link sent to ${maskEmail(normalizedEmail)}.`);
    } catch (error) {
      console.error("Failed to send magic link:", error);
      setErrorMessage(error?.message || "Unable to send a magic link right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <Link to={publicRoutes.home} className="inline-flex items-center gap-2">
            <img src="/base25-logo.png" alt="base25" className="h-8 w-8 object-contain" />
            <span className="text-base font-semibold text-slate-900">base25</span>
          </Link>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Secure Sign In
          </span>
        </div>

        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Sign In</h1>
          <p className="text-sm text-slate-600">
            Enter your email and we’ll send you a magic link to sign in.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrorMessage("");
              }}
              className="mt-1.5"
              placeholder="you@company.com"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void sendMagicLink();
                }
              }}
            />
          </div>

          {message ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              {message}
            </p>
          ) : null}
          {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

          <Button
            className="w-full bg-black text-white hover:bg-black/90"
            onClick={() => {
              void sendMagicLink();
            }}
            disabled={submitting || cooldown > 0}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending magic link...
              </>
            ) : cooldown > 0 ? (
              `Resend in ${cooldown}s`
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Magic Link
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
