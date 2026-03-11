export function isOwnerRole(role) {
  return role === "owner";
}

export function isAdminRole(role) {
  return role === "admin" || role === "owner";
}

export function isStaffRole(role) {
  return isAdminRole(role);
}

export function canContributeRole(role) {
  return role === "contributor" || isAdminRole(role);
}

export function getRoleLabel(role) {
  if (!role) return "Contributor";
  const normalized = String(role).trim().toLowerCase();
  if (!normalized) return "Contributor";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
