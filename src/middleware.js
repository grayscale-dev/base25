import { NextResponse } from "next/server";
import { WORKSPACE_DEFAULT_SECTION } from "./lib/workspace-sections";

const canonicalStaticPaths = {
  "/home": "/",
  "/about": "/about",
  "/features": "/features",
  "/pricing": "/pricing",
  "/workspaces": "/workspaces",
  "/joinworkspace": "/join-workspace",
  "/billing": "/billing",
  "/apidocs": "/api-docs",
  "/workspacesettings": "/workspace-settings",
};

export function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const lowerPathname = pathname.toLowerCase();

  if (lowerPathname.startsWith("/workspace/")) {
    const pathParts = pathname.split("/").filter(Boolean);
    const slug = pathParts[1];
    const section = pathParts[2];
    const remainder = pathParts.slice(3);
    if (slug && !section) {
      const url = request.nextUrl.clone();
      url.pathname = `/workspace/${slug}/${WORKSPACE_DEFAULT_SECTION}`;
      return NextResponse.redirect(url, 308);
    }
    if (slug && section) {
      const canonicalWorkspacePath = [
        "",
        "workspace",
        slug,
        section.toLowerCase(),
        ...remainder,
      ].join("/");
      if (pathname !== canonicalWorkspacePath) {
        const url = request.nextUrl.clone();
        url.pathname = canonicalWorkspacePath;
        return NextResponse.redirect(url, 308);
      }
    }
    return NextResponse.next();
  }

  const canonicalPath = canonicalStaticPaths[lowerPathname];

  if (!canonicalPath || pathname === canonicalPath) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = canonicalPath;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/:path*"],
};
