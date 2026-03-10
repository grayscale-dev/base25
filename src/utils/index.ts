const routeByPageName: Record<string, string> = {
  Home: "/",
  About: "/about",
  Features: "/features",
  Pricing: "/pricing",
  Workspaces: "/workspaces",
  WorkspaceSelector: "/workspaces",
  JoinWorkspace: "/join-workspace",
  Billing: "/billing",
  ApiDocs: "/api-docs",
  WorkspaceSettings: "/workspace-settings",
};

export function createPageUrl(pageName: string) {
  const mappedRoute = routeByPageName[pageName];
  if (mappedRoute) {
    return mappedRoute;
  }

  // Fallback for unknown pages: slugify and force lowercase canonical paths.
  return `/${pageName.trim().replace(/\s+/g, "-").toLowerCase()}`;
}
