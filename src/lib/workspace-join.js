import { base44 } from "@/api/base44Client";

function statusFromError(error) {
  return error?.status ?? error?.context?.status ?? error?.response?.status ?? null;
}

function toSlugToken(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  return normalized.replace(/^\/+|\/+$/g, "");
}

export function parseWorkspaceSlug(rawInput, origin = window.location.origin) {
  const input = String(rawInput || "").trim();
  if (!input) return null;

  const parseFromPath = (pathname) => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] === "workspace" && parts[1]) {
      return toSlugToken(parts[1]);
    }
    if (parts[0] === "join-workspace") {
      return null;
    }
    if (parts[0] && parts.length === 1) {
      return toSlugToken(parts[0]);
    }
    return null;
  };

  try {
    const candidateUrl = /^https?:\/\//i.test(input)
      ? new URL(input)
      : new URL(input, origin);
    const slugParam = candidateUrl.searchParams.get("workspace");
    if (slugParam) {
      return toSlugToken(slugParam);
    }
    const fromPath = parseFromPath(candidateUrl.pathname);
    if (fromPath) {
      return fromPath;
    }
  } catch {
    // Ignore URL parsing errors and fall through to raw parsing.
  }

  const rawParts = input.split("/").filter(Boolean);
  if (rawParts[0] === "workspace" && rawParts[1]) {
    return toSlugToken(rawParts[1]);
  }

  return toSlugToken(rawParts[0] || input);
}

export async function resolveWorkspaceJoinCandidate(slug) {
  try {
    const { data } = await base44.functions.invoke(
      "publicGetWorkspace",
      { slug },
      { authMode: "user" }
    );
    return { status: "accessible", workspace: data };
  } catch (error) {
    const status = statusFromError(error);
    if (status === 404) {
      return { status: "not_found" };
    }
    if (status === 403) {
      return { status: "requires_code" };
    }
    if (status === 401) {
      return { status: "auth_required" };
    }
    throw error;
  }
}

export async function getWorkspaceRole(workspaceId, userId) {
  const roles = await base44.entities.WorkspaceRole.filter({
    workspace_id: workspaceId,
    user_id: userId,
  });
  return roles[0] || null;
}

export async function ensureWorkspaceMembership({ workspace, user }) {
  const existingRole = await getWorkspaceRole(workspace.id, user.id);
  if (existingRole) {
    return {
      workspace,
      role: existingRole.role || "viewer",
      alreadyMember: true,
    };
  }

  const createdRole = await base44.entities.WorkspaceRole.create({
    workspace_id: workspace.id,
    user_id: user.id,
    email: user.email,
    role: "viewer",
    assigned_via: workspace.visibility === "public" ? "public" : "explicit",
  });

  return {
    workspace,
    role: createdRole?.role || "viewer",
    alreadyMember: false,
  };
}

export async function joinWorkspaceWithCode({ slug, accessCode }) {
  const { data } = await base44.functions.invoke(
    "joinWorkspaceWithAccessCode",
    {
      slug,
      access_code: accessCode.trim(),
    },
    { authMode: "user" }
  );

  return {
    workspace: data?.workspace || null,
    role: data?.role || "contributor",
  };
}

