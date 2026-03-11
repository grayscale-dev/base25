export const ITEM_GROUP_KEYS = ["feedback", "roadmap", "changelog"];

export const ITEM_GROUP_LABELS = {
  feedback: "Feedback",
  roadmap: "Roadmap",
  changelog: "Changelog",
};

export const ITEM_GROUP_COLORS = {
  feedback: "#2563EB",
  roadmap: "#7C3AED",
  changelog: "#059669",
};

export const DEFAULT_GROUP_STATUSES = {
  feedback: [
    { label: "Open" },
    { label: "Under review" },
    { label: "Planned" },
    { label: "In progress" },
    { label: "Completed" },
    { label: "Closed" },
  ],
  roadmap: [
    { label: "Planned" },
    { label: "In progress" },
    { label: "Shipped" },
  ],
  changelog: [{ label: "Published" }],
};

export const PRIORITY_CONFIG = {
  low: { label: "Low", color: "#64748B" },
  medium: { label: "Medium", color: "#2563EB" },
  high: { label: "High", color: "#D97706" },
  critical: { label: "Critical", color: "#DC2626" },
  not_set: { label: "No Priority", color: "#94A3B8" },
};

export const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];

export function getGroupLabel(groupKey, fallback = "Items") {
  return ITEM_GROUP_LABELS[groupKey] || fallback;
}

export function getGroupColor(groupKey, fallback = "#0F172A") {
  return ITEM_GROUP_COLORS[groupKey] || fallback;
}

export function normalizeGroupKey(value, fallback = "feedback") {
  if (!value) return fallback;
  const normalized = String(value).toLowerCase();
  return ITEM_GROUP_KEYS.includes(normalized) ? normalized : fallback;
}

export function sanitizeStatusKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getPriorityLabel(priorityKey) {
  return PRIORITY_CONFIG[priorityKey]?.label || PRIORITY_CONFIG.not_set.label;
}

export function getPriorityColor(priorityKey) {
  return PRIORITY_CONFIG[priorityKey]?.color || PRIORITY_CONFIG.not_set.color;
}

export function getMetadataShapeForGroup(groupKey) {
  if (groupKey === "feedback") {
    return {
      type: "feature_request",
      priority: "medium",
      steps_to_reproduce: "",
      expected_behavior: "",
      actual_behavior: "",
      environment: "",
      attachments: [],
    };
  }

  if (groupKey === "roadmap") {
    return {};
  }

  return {
    release_date: "",
    announcement_type: "release",
  };
}

export function validateMetadata(groupKey, metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { valid: false, message: "Metadata must be an object." };
  }

  if (groupKey === "feedback") {
    const allowedTypes = ["bug", "feature_request", "improvement", "question"];
    if (metadata.type && !allowedTypes.includes(metadata.type)) {
      return { valid: false, message: "Feedback type is invalid." };
    }
    const allowedPriority = ["low", "medium", "high", "critical"];
    if (metadata.priority && !allowedPriority.includes(metadata.priority)) {
      return { valid: false, message: "Priority is invalid." };
    }
  } else if (groupKey === "changelog") {
    if (
      metadata.announcement_type &&
      !["release", "hotfix", "announcement"].includes(metadata.announcement_type)
    ) {
      return { valid: false, message: "Announcement type is invalid." };
    }
  }

  return { valid: true, message: "" };
}
