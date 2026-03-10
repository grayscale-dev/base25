import {
  getDefaultWorkspaceSection,
  WORKSPACE_DEFAULT_SECTION,
} from "@/lib/workspace-sections";

/**
 * Generate canonical workspace URL paths.
 * @param {string} slug - Workspace slug
 * @param {string} section - Workspace section (all, feedback, roadmap, changelog)
 * @param {Object} options - Additional options
 * @param {string} options.query - Query string (e.g., "?id=123&tab=details")
 * @returns {string} Canonical workspace URL path
 */
export function workspaceUrl(slug, section, options = {}) {
  const resolvedSection = section || WORKSPACE_DEFAULT_SECTION;
  const path = `/workspace/${slug}/${resolvedSection}`;
  return options.query ? `${path}${options.query}` : path;
}

export function workspaceDefaultUrl(slug, role = "viewer", isPublicAccess = false, options = {}) {
  return workspaceUrl(slug, getDefaultWorkspaceSection(role, isPublicAccess), options);
}

export function workspaceItemUrl(slug, itemId, options = {}) {
  const path = `/workspace/${slug}/item/${itemId}`;
  return options.query ? `${path}${options.query}` : path;
}

/**
 * Build query string from params object
 * @param {Object} params - Query parameters
 * @returns {string} Query string (e.g., "?id=123&tab=details")
 */
export function buildQuery(params) {
  if (!params || Object.keys(params).length === 0) return '';
  const searchParams = new URLSearchParams(params);
  return `?${searchParams.toString()}`;
}
