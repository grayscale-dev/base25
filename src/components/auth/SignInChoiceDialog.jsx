"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabase-client";
import { subscribeSignInChoice } from "@/lib/sign-in-choice";
import { publicRoutes } from "@/lib/public-routes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function resolveRedirectTo(requestOptions) {
  if (requestOptions?.redirectTo) {
    return requestOptions.redirectTo;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${publicRoutes.workspaceHub}`;
}

export default function SignInChoiceDialog() {
  const [request, setRequest] = useState(null);
  const [mode, setMode] = useState("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeSignInChoice((nextRequest) => {
      setRequest(nextRequest);
      setMode("choice");
      setEmail("");
      setPassword("");
      setSubmitting(false);
      setErrorMessage("");
    });

    return unsubscribe;
  }, []);

  const isOpen = Boolean(request);
  const redirectTo = useMemo(
    () => resolveRedirectTo(request?.options),
    [request?.options]
  );

  const close = (payload = { ok: false, cancelled: true }) => {
    request?.resolve?.(payload);
    setRequest(null);
    setSubmitting(false);
    setErrorMessage("");
    setMode("choice");
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      localStorage.setItem("post_login_redirect", redirectTo);
      await base44.auth.login("google");
      close({ ok: true, method: "google" });
    } catch (error) {
      console.error("Google sign-in failed:", error);
      setErrorMessage(error?.message || "Unable to start Google sign-in.");
      setSubmitting(false);
    }
  };

  const handleEmailPasswordSignIn = async () => {
    if (!email.trim() || !password) {
      setErrorMessage("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        throw error;
      }

      localStorage.removeItem("post_login_redirect");
      window.location.assign(redirectTo);
      close({ ok: true, method: "password" });
    } catch (error) {
      console.error("Email/password sign-in failed:", error);
      setErrorMessage(error?.message || "Unable to sign in with email/password.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !submitting) {
          close({ ok: false, cancelled: true });
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sign In</DialogTitle>
          <DialogDescription>
            Choose how you want to sign in to your workspace.
          </DialogDescription>
        </DialogHeader>

        {mode === "choice" ? (
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setMode("password")}
              disabled={submitting}
            >
              <Mail className="mr-2 h-4 w-4" />
              Email + Password
            </Button>
            <Button
              className="w-full bg-slate-900 text-white hover:bg-slate-800"
              onClick={handleGoogleSignIn}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Google sign-in...
                </>
              ) : (
                "Sign in with Google"
              )}
            </Button>
            {errorMessage ? (
              <p className="text-sm text-rose-600">{errorMessage}</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="mt-1.5"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleEmailPasswordSignIn();
                  }
                }}
              />
            </div>
            {errorMessage ? (
              <p className="text-sm text-rose-600">{errorMessage}</p>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMode("choice");
                  setErrorMessage("");
                }}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                type="button"
                className="bg-slate-900 text-white hover:bg-slate-800"
                onClick={handleEmailPasswordSignIn}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
