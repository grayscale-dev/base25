let idCounter = 1;

function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function makeUser(overrides = {}) {
  return {
    id: nextId("user"),
    email: "user@example.com",
    first_name: "Test",
    last_name: "User",
    full_name: "Test User",
    profile_photo_url: null,
    ...overrides,
  };
}

export function makeWorkspace(overrides = {}) {
  return {
    id: nextId("workspace"),
    name: "Acme",
    slug: "acme",
    visibility: "restricted",
    status: "active",
    logo_url: "",
    primary_color: "#0f172a",
    billing_status: "active",
    billing_access_allowed: true,
    ...overrides,
  };
}

export function makeStatus(overrides = {}) {
  return {
    id: nextId("status"),
    workspace_id: nextId("workspace-ref"),
    group_key: "feedback",
    status_key: "open",
    label: "Open",
    display_order: 0,
    is_active: true,
    ...overrides,
  };
}

export function makeItemType(overrides = {}) {
  return {
    id: nextId("item-type"),
    label: "Feature",
    display_order: 0,
    is_active: true,
    ...overrides,
  };
}

export function makeItem(overrides = {}) {
  return {
    id: nextId("item"),
    workspace_id: nextId("workspace-ref"),
    group_key: "feedback",
    status_id: nextId("status-ref"),
    status_key: "open",
    status_label: "Open",
    group_label: "Feedback",
    group_color: "#2563EB",
    item_type_id: nextId("item-type-ref"),
    item_type_label: "Feature",
    title: "Improve onboarding",
    description: "Customers are asking for better onboarding",
    metadata: { priority: "medium", type: "feature_request" },
    watched: false,
    watcher_count: 0,
    reaction_summary: [],
    reaction_count: 0,
    created_at: "2026-03-01T10:00:00.000Z",
    updated_at: "2026-03-01T10:00:00.000Z",
    ...overrides,
  };
}

export function makeAlert(overrides = {}) {
  return {
    id: nextId("alert"),
    workspace_id: nextId("workspace-ref"),
    item_id: nextId("item-ref"),
    alert_type: "status_change",
    title: "Status changed",
    body: "Item moved to In Progress",
    is_read: false,
    created_at: "2026-03-01T10:00:00.000Z",
    ...overrides,
  };
}
