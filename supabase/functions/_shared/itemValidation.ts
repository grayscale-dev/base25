export const ITEM_GROUP_KEYS = ["feedback", "roadmap", "changelog"] as const;
type ItemGroupKey = (typeof ITEM_GROUP_KEYS)[number];

export function isValidGroupKey(value: unknown): value is ItemGroupKey {
  return typeof value === "string" && ITEM_GROUP_KEYS.includes(value as ItemGroupKey);
}

export function validateMetadata(groupKey: ItemGroupKey, metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { valid: false, message: "metadata must be an object" };
  }

  const data = metadata as Record<string, unknown>;

  if (groupKey === "feedback") {
    const allowedTypes = ["bug", "feature_request", "improvement", "question"];
    const allowedPriorities = ["low", "medium", "high", "critical"];
    if (data.type && !allowedTypes.includes(String(data.type))) {
      return { valid: false, message: "Invalid feedback metadata.type" };
    }
    if (data.priority && !allowedPriorities.includes(String(data.priority))) {
      return { valid: false, message: "Invalid feedback metadata.priority" };
    }
  }

  if (groupKey === "roadmap") {
    if (data.display_order !== undefined && Number.isNaN(Number(data.display_order))) {
      return { valid: false, message: "metadata.display_order must be numeric" };
    }
  }

  if (groupKey === "changelog") {
    const allowedTypes = ["release", "hotfix", "announcement"];
    if (data.announcement_type && !allowedTypes.includes(String(data.announcement_type))) {
      return { valid: false, message: "Invalid changelog metadata.announcement_type" };
    }
  }

  return { valid: true, message: "" };
}
