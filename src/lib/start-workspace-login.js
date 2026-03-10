"use client";

import { base44 } from "@/api/base44Client";
import { publicRoutes } from "@/lib/public-routes";

export async function startWorkspaceLogin() {
  const workspaceHubUrl = `${window.location.origin}${publicRoutes.workspaceHub}`;

  try {
    const isAuthenticated = await base44.auth.isAuthenticated();
    if (isAuthenticated) {
      window.location.assign(workspaceHubUrl);
      return { ok: true };
    }

    return await base44.auth.redirectToLogin(workspaceHubUrl);
  } catch (error) {
    console.error("Unable to start workspace login:", error);
    return { ok: false, error };
  }
}

