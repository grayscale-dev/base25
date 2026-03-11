"use client";

import { publicRoutes } from "@/lib/public-routes";

function buildSignInUrl(returnTo) {
  const target = returnTo || `${window.location.origin}${publicRoutes.workspaceHub}`;
  const currentUrl = new URL(window.location.href);
  const signInUrl = new URL(publicRoutes.signIn, currentUrl.origin);
  const targetUrl = new URL(target, currentUrl.origin);
  signInUrl.searchParams.set(
    "returnTo",
    `${targetUrl.pathname}${targetUrl.search}`
  );
  return signInUrl.toString();
}

export async function startWorkspaceLogin(options = {}) {
  window.location.assign(buildSignInUrl(options.redirectTo));
  return { ok: true };
}
