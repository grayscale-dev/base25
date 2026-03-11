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

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

function sanitizeReturnTo(rawValue) {
  if (!rawValue) return null;
  const value = String(rawValue).trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/auth/sign-in")) return null;
  return value;
}

function maskEmail(email) {
  const [local, domain] = String(email || "").split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] || ""}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export default function AuthSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
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
    let isMounted = true;

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted || !session) return;
      router.replace(returnTo);
      router.refresh();
    };

    void checkSession();
    return () => {
      isMounted = false;
    };
  }, [returnTo, router]);

  const sendCode = async () => {
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
        },
      });

      if (error) throw error;

      setEmail(normalizedEmail);
      setStep("code");
      setToken("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage(`A 6-digit code was sent to ${maskEmail(normalizedEmail)}.`);
    } catch (error) {
      console.error("Failed to send sign-in code:", error);
      setErrorMessage(error?.message || "Unable to send a code right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async () => {
    const normalizedToken = token.trim();
    if (normalizedToken.length !== OTP_LENGTH) {
      setErrorMessage("Enter the 6-digit code from your email.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: normalizedToken,
        type: "email",
      });

      if (error) throw error;

      router.replace(returnTo);
      router.refresh();
    } catch (error) {
      console.error("Failed to verify sign-in code:", error);
      setErrorMessage(error?.message || "Invalid or expired code. Request a new code.");
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
            {step === "email"
              ? "Enter your email and we’ll send a 6-digit code."
              : `Enter the code sent to ${maskEmail(email)}.`}
          </p>
        </div>

        <div className="space-y-4">
          {step === "email" ? (
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
                    void sendCode();
                  }
                }}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="auth-token">6-digit code</Label>
              <Input
                id="auth-token"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={token}
                onChange={(event) => {
                  const numeric = event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
                  setToken(numeric);
                  setErrorMessage("");
                }}
                className="mt-1.5 text-center font-mono tracking-[0.35em]"
                placeholder="123456"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void verifyCode();
                  }
                }}
              />
            </div>
          )}

          {message ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              {message}
            </p>
          ) : null}
          {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

          {step === "email" ? (
            <Button
              className="w-full bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => {
                void sendCode();
              }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending code...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Code
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                className="w-full bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => {
                  void verifyCode();
                }}
                disabled={submitting || token.trim().length !== OTP_LENGTH}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Sign In"
                )}
              </Button>
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-0 text-slate-600"
                  onClick={() => {
                    setStep("email");
                    setToken("");
                    setMessage("");
                    setErrorMessage("");
                  }}
                  disabled={submitting}
                >
                  Use a different email
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-0 text-slate-600"
                  onClick={() => {
                    void sendCode();
                  }}
                  disabled={submitting || cooldown > 0}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
