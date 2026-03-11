import { ITEM_GROUP_KEYS } from "./item-groups";
import { isAdminRole } from "@/lib/roles";

export const WORKSPACE_ALIAS_SECTION = "items";
export const WORKSPACE_DEFAULT_SECTION = "feedback";
export const WORKSPACE_ALL_SECTION = "all";
export const WORKSPACE_GROUP_SECTIONS = [...ITEM_GROUP_KEYS];
export const WORKSPACE_SECTION_KEYS = [WORKSPACE_ALL_SECTION, ...WORKSPACE_GROUP_SECTIONS];

const PAGE_NAME_BY_SECTION = {
  all: "All",
  feedback: "Feedback",
  roadmap: "Roadmap",
  changelog: "Changelog",
  items: "Items",
};

export function normalizeWorkspaceSection(section) {
  return String(section || "").trim().toLowerCase();
}

export function getWorkspacePageName(section) {
  const normalized = normalizeWorkspaceSection(section);
  return PAGE_NAME_BY_SECTION[normalized] || null;
}

export function getDefaultWorkspaceSection(role = "viewer", isPublicAccess = false) {
  return isAdminRole(role) && !isPublicAccess
    ? WORKSPACE_ALL_SECTION
    : WORKSPACE_DEFAULT_SECTION;
}

export function resolveWorkspaceSection(section, role = "viewer", isPublicAccess = false) {
  const normalized = normalizeWorkspaceSection(section);
  if (!normalized) return null;

  if (normalized === WORKSPACE_ALIAS_SECTION) {
    return getDefaultWorkspaceSection(role, isPublicAccess);
  }

  if (normalized === WORKSPACE_ALL_SECTION) {
    return isAdminRole(role) && !isPublicAccess
      ? WORKSPACE_ALL_SECTION
      : WORKSPACE_DEFAULT_SECTION;
  }

  return WORKSPACE_GROUP_SECTIONS.includes(normalized) ? normalized : null;
}

export function isWorkspaceSection(section) {
  const normalized = normalizeWorkspaceSection(section);
  return (
    normalized === WORKSPACE_ALIAS_SECTION ||
    WORKSPACE_SECTION_KEYS.includes(normalized)
  );
}
