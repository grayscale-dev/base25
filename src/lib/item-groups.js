export const ITEM_GROUP_KEYS = ["feedback", "roadmap", "changelog"];

export const ITEM_GROUP_LABELS = {
  feedback: "Feedback",
  roadmap: "Roadmap",
  changelog: "Changelog",
};

export const DEFAULT_GROUP_STATUSES = {
  feedback: [
    { key: "open", label: "Open" },
    { key: "under_review", label: "Under review" },
    { key: "planned", label: "Planned" },
    { key: "in_progress", label: "In progress" },
    { key: "completed", label: "Completed" },
    { key: "closed", label: "Closed" },
  ],
  roadmap: [
    { key: "planned", label: "Planned" },
    { key: "in_progress", label: "In progress" },
    { key: "shipped", label: "Shipped" },
  ],
  changelog: [{ key: "published", label: "Published" }],
};

export function getGroupLabel(groupKey, fallback = "Items") {
  return ITEM_GROUP_LABELS[groupKey] || fallback;
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
    return {
      target_date: "",
      target_quarter: "",
      display_order: 0,
      release_note_ready: false,
    };
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
  } else if (groupKey === "roadmap") {
    if (metadata.display_order !== undefined && Number.isNaN(Number(metadata.display_order))) {
      return { valid: false, message: "Display order must be a number." };
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
