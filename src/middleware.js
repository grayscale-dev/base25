import { NextResponse } from "next/server";
import { WORKSPACE_DEFAULT_SECTION } from "./lib/workspace-sections";
import {
  createSupabaseMiddlewareClient,
  withSupabaseCookies,
} from "./lib/supabase/middleware";

const canonicalStaticPaths = {
  "/home": "/",
  "/about": "/about",
  "/features": "/features",
  "/pricing": "/pricing",
  "/workspaces": "/workspaces",
  "/joinworkspace": "/join-workspace",
  "/billing": "/billing",
  "/alerts": "/alerts",
  "/search": "/search",
  "/apidocs": "/api-docs",
  "/workspacesettings": "/workspace-settings",
  "/auth/signin": "/auth/sign-in",
  "/auth/callback": "/auth/callback",
};

const PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/features",
  "/pricing",
  "/auth/sign-in",
  "/auth/callback",
]);

function isStaticAsset(pathname) {
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/")
  ) {
    return true;
  }

  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function getCanonicalPath(pathname) {
  const lowerPathname = pathname.toLowerCase();

  if (lowerPathname.startsWith("/workspace/")) {
    const pathParts = pathname.split("/").filter(Boolean);
    const slug = pathParts[1];
    const section = pathParts[2];
    const remainder = pathParts.slice(3);

    if (slug && !section) {
      return `/workspace/${slug.toLowerCase()}/${WORKSPACE_DEFAULT_SECTION}`;
    }

    if (slug && section) {
      return [
        "",
        "workspace",
        slug.toLowerCase(),
        section.toLowerCase(),
        ...remainder,
      ].join("/");
    }
  }

  const normalizedPath =
    pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const mappedPath = canonicalStaticPaths[normalizedPath.toLowerCase()];
  return mappedPath || normalizedPath;
}

function sanitizeReturnTo(rawValue) {
  if (!rawValue) return null;

  const value = String(rawValue).trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  if (value.startsWith("/auth/sign-in") || value.startsWith("/auth/callback")) {
    return null;
  }
  return value;
}

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const canonicalPath = getCanonicalPath(pathname);
  if (pathname !== canonicalPath) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = canonicalPath;
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const { supabase, response } = createSupabaseMiddlewareClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.has(pathname);
  const isSignInRoute = pathname === "/auth/sign-in";

  if (!user && !isPublicPath) {
    const returnTo = `${pathname}${request.nextUrl.search}`;
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/auth/sign-in";
    signInUrl.searchParams.set("returnTo", returnTo);
    const redirectResponse = NextResponse.redirect(signInUrl, 307);
    return withSupabaseCookies(redirectResponse, response);
  }

  if (user && isSignInRoute) {
    const requestedReturnTo = sanitizeReturnTo(
      request.nextUrl.searchParams.get("returnTo")
    );
    const destinationUrl = request.nextUrl.clone();
    destinationUrl.pathname = requestedReturnTo || "/workspaces";
    destinationUrl.search = "";
    const redirectResponse = NextResponse.redirect(destinationUrl, 307);
    return withSupabaseCookies(redirectResponse, response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
