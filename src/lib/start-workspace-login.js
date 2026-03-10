"use client";

import { base44 } from "@/api/base44Client";
import { publicRoutes } from "@/lib/public-routes";
import { openSignInChoice } from "@/lib/sign-in-choice";

export async function startWorkspaceLogin(options = {}) {
  const workspaceHubUrl =
    options.redirectTo || `${window.location.origin}${publicRoutes.workspaceHub}`;

  try {
    const isAuthenticated = await base44.auth.isAuthenticated();
    if (isAuthenticated) {
      window.location.assign(workspaceHubUrl);
      return { ok: true };
    }

    return await openSignInChoice({ redirectTo: workspaceHubUrl });
  } catch (error) {
    console.error("Unable to start workspace login:", error);
    return { ok: false, error };
  }
}
