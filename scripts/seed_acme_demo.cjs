const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const TARGET_EMAIL = "admin@grayscale-dev.com";
const TARGET_WORKSPACE_SLUG = "acme";
const TARGET_WORKSPACE_NAME = "Acme";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const contents = fs.readFileSync(envPath, "utf8");
  contents.split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith("#")) return;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) return;
    const key = match[1].trim();
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

function nowIso() {
  return new Date().toISOString();
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function findAuthUserByEmail(adminClient, email) {
  const perPage = 200;
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find(
      (user) => String(user?.email || "").toLowerCase() === String(email).toLowerCase()
    );
    if (match) return match;
    if (users.length < perPage) break;
  }
  return null;
}

async function ensureTargetUser(adminClient) {
  let user = await findAuthUserByEmail(adminClient, TARGET_EMAIL);
  if (user) return user;

  const tempPassword = `Demo-${crypto.randomBytes(8).toString("hex")}!9aA`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email: TARGET_EMAIL,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      first_name: "Admin",
      last_name: "Demo",
      full_name: "Admin Demo",
    },
  });

  if (error) {
    if (!String(error.message || "").toLowerCase().includes("already")) {
      throw error;
    }
  } else if (data?.user) {
    return data.user;
  }

  user = await findAuthUserByEmail(adminClient, TARGET_EMAIL);
  if (!user) {
    throw new Error(`Unable to resolve user for ${TARGET_EMAIL}`);
  }
  return user;
}

async function ensureWorkspace(adminClient) {
  const payload = {
    name: TARGET_WORKSPACE_NAME,
    slug: TARGET_WORKSPACE_SLUG,
    description:
      "Acme demo workspace for product feedback, roadmap planning, and changelog walkthroughs.",
    primary_color: "#0F172A",
    visibility: "restricted",
    settings: {},
    status: "active",
    updated_at: nowIso(),
  };

  const { data, error } = await adminClient
    .from("workspaces")
    .upsert(payload, { onConflict: "slug" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function lockWorkspaceMembership(adminClient, workspaceId, targetUser) {
  const { error: deleteOtherRolesError } = await adminClient
    .from("workspace_roles")
    .delete()
    .eq("workspace_id", workspaceId)
    .neq("user_id", targetUser.id);
  if (deleteOtherRolesError) throw deleteOtherRolesError;

  const ownerRole = {
    workspace_id: workspaceId,
    user_id: targetUser.id,
    email: TARGET_EMAIL,
    role: "owner",
    updated_at: nowIso(),
  };

  const { error: upsertRoleError } = await adminClient
    .from("workspace_roles")
    .upsert(ownerRole, { onConflict: "workspace_id,user_id" });
  if (upsertRoleError) throw upsertRoleError;

  const { error: clearRulesError } = await adminClient
    .from("workspace_access_rules")
    .delete()
    .eq("workspace_id", workspaceId);
  if (clearRulesError) throw clearRulesError;

  const { error: clearCodesError } = await adminClient
    .from("workspace_access_codes")
    .delete()
    .eq("workspace_id", workspaceId);
  if (clearCodesError) throw clearCodesError;
}

async function ensureBillingAccess(adminClient, workspaceId) {
  const { data: existing, error: lookupError } = await adminClient
    .from("billing_customers")
    .select("workspace_id, status")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const status = String(existing?.status || "").toLowerCase();
  if (status === "active" || status === "trialing") return;

  const trialingPayload = {
    workspace_id: workspaceId,
    status: "trialing",
    trial_end: daysFromNow(14),
    current_period_start: nowIso(),
    current_period_end: daysFromNow(30),
    cancel_at_period_end: false,
    canceled_at: null,
    updated_at: nowIso(),
  };

  const { error: upsertError } = await adminClient
    .from("billing_customers")
    .upsert(trialingPayload, { onConflict: "workspace_id" });
  if (upsertError) throw upsertError;
}

async function clearDemoData(adminClient, workspaceId) {
  const wipeTables = [
    "user_alerts",
    "item_activity_reactions",
    "item_reactions",
    "item_watchers",
    "item_activities",
    "items",
  ];

  for (const table of wipeTables) {
    const { error } = await adminClient
      .from(table)
      .delete()
      .eq("workspace_id", workspaceId);
    if (error) throw error;
  }
}

async function ensureStatusAndTypeConfig(adminClient, workspaceId) {
  const { error: statusSeedError } = await adminClient.rpc("seed_default_item_statuses", {
    target_workspace_id: workspaceId,
  });
  if (statusSeedError) throw statusSeedError;

  const { error: typeSeedError } = await adminClient.rpc("seed_default_item_types", {
    target_workspace_id: workspaceId,
  });
  if (typeSeedError) throw typeSeedError;

  const { data: statuses, error: statusesError } = await adminClient
    .from("item_statuses")
    .select("id, group_key, status_key, label, display_order, created_at")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (statusesError) throw statusesError;

  const { data: itemTypes, error: itemTypesError } = await adminClient
    .from("item_types")
    .select("id, label, display_order, created_at")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (itemTypesError) throw itemTypesError;

  const statusesByGroup = new Map();
  for (const status of statuses || []) {
    const groupKey = String(status.group_key || "").toLowerCase();
    if (!statusesByGroup.has(groupKey)) statusesByGroup.set(groupKey, []);
    statusesByGroup.get(groupKey).push(status);
  }

  const pickStatus = (groupKey, preferredLabel) => {
    const rows = statusesByGroup.get(groupKey) || [];
    const preferred = rows.find(
      (row) => normalizeLabel(row.label) === normalizeLabel(preferredLabel)
    );
    return preferred || rows[0] || null;
  };

  const typesByLabel = new Map();
  for (const type of itemTypes || []) {
    const key = normalizeLabel(type.label);
    if (!typesByLabel.has(key)) {
      typesByLabel.set(key, type);
    }
  }

  const pickType = (preferredLabel) => {
    const preferred = typesByLabel.get(normalizeLabel(preferredLabel));
    if (preferred) return preferred;
    return itemTypes?.[0] || null;
  };

  const requiredStatuses = [
    pickStatus("feedback", "Open"),
    pickStatus("feedback", "Under review"),
    pickStatus("feedback", "Planned"),
    pickStatus("feedback", "In progress"),
    pickStatus("feedback", "Completed"),
    pickStatus("roadmap", "Planned"),
    pickStatus("roadmap", "In progress"),
    pickStatus("roadmap", "Shipped"),
    pickStatus("changelog", "Published"),
  ];

  if (requiredStatuses.some((row) => !row?.id)) {
    throw new Error("Unable to resolve default status configuration for demo seed.");
  }

  const requiredTypes = [
    pickType("Feature Request"),
    pickType("Bug"),
    pickType("Improvement"),
    pickType("Announcement"),
  ];
  if (requiredTypes.some((row) => !row?.id)) {
    throw new Error("Unable to resolve item types for demo seed.");
  }

  return {
    pickStatus,
    pickType,
  };
}

function buildDemoItemRows({ workspaceId, userId, userEmail, pickStatus, pickType }) {
  const statusFeedbackOpen = pickStatus("feedback", "Open");
  const statusFeedbackReview = pickStatus("feedback", "Under review");
  const statusFeedbackPlanned = pickStatus("feedback", "Planned");
  const statusFeedbackProgress = pickStatus("feedback", "In progress");
  const statusFeedbackDone = pickStatus("feedback", "Completed");
  const statusRoadmapPlanned = pickStatus("roadmap", "Planned");
  const statusRoadmapProgress = pickStatus("roadmap", "In progress");
  const statusRoadmapShipped = pickStatus("roadmap", "Shipped");
  const statusChangelogPublished = pickStatus("changelog", "Published");

  const typeFeature = pickType("Feature Request");
  const typeBug = pickType("Bug");
  const typeImprovement = pickType("Improvement");
  const typeAnnouncement = pickType("Announcement");

  const items = [
    {
      key: "feedback-shortcuts",
      title: "Add keyboard triage shortcuts in feedback",
      description:
        "Power users want fast status updates without opening each item. Improve triage speed for larger inboxes.",
      status: statusFeedbackOpen,
      type: typeFeature,
      metadata: {
        type: "feature_request",
        priority: "high",
        steps_to_reproduce: "",
        expected_behavior: "",
        actual_behavior: "",
        environment: "",
        attachments: [],
      },
      vote_count: 42,
      created_at: daysAgo(16),
      assigned_to: userId,
    },
    {
      key: "feedback-sso-bug",
      title: "SSO setup wizard fails with long tenant names",
      description:
        "The last step can fail when the tenant identifier exceeds 40 characters.",
      status: statusFeedbackReview,
      type: typeBug,
      metadata: {
        type: "bug",
        priority: "critical",
        steps_to_reproduce: "Create an SSO tenant with a long name, then complete setup.",
        expected_behavior: "Setup completes and workspace can log in via SSO.",
        actual_behavior: "Wizard errors out at final validation.",
        environment: "Production",
        attachments: [],
      },
      vote_count: 18,
      created_at: daysAgo(13),
      assigned_to: userId,
    },
    {
      key: "feedback-comment-mentions",
      title: "Mention teammates in comments",
      description:
        "Contributors want @mentions in discussion threads to loop in the right internal owner quickly.",
      status: statusFeedbackPlanned,
      type: typeImprovement,
      metadata: {
        type: "improvement",
        priority: "medium",
        steps_to_reproduce: "",
        expected_behavior: "",
        actual_behavior: "",
        environment: "",
        attachments: [],
      },
      vote_count: 27,
      created_at: daysAgo(10),
      assigned_to: null,
    },
    {
      key: "feedback-csv-truncation",
      title: "CSV export truncates long descriptions",
      description:
        "Exported feedback descriptions are truncated around 10k chars in some rows.",
      status: statusFeedbackProgress,
      type: typeBug,
      metadata: {
        type: "bug",
        priority: "high",
        steps_to_reproduce: "Export feedback list with long rich-text descriptions.",
        expected_behavior: "CSV includes full content.",
        actual_behavior: "Rows truncate unpredictably.",
        environment: "Production + Chrome",
        attachments: [],
      },
      vote_count: 11,
      created_at: daysAgo(8),
      assigned_to: userId,
    },
    {
      key: "feedback-roadmap-search",
      title: "Global search now includes roadmap and changelog context",
      description:
        "Shipped improvement to search quality with better matching on comments and descriptions.",
      status: statusFeedbackDone,
      type: typeImprovement,
      metadata: {
        type: "improvement",
        priority: "medium",
        steps_to_reproduce: "",
        expected_behavior: "",
        actual_behavior: "",
        environment: "",
        attachments: [],
      },
      vote_count: 9,
      created_at: daysAgo(6),
      assigned_to: userId,
    },
    {
      key: "roadmap-permissions",
      title: "Permissions overhaul for internal vs contributor actions",
      description:
        "Finalize owner/admin controls while keeping contributor workflows simple and safe.",
      status: statusRoadmapPlanned,
      type: typeFeature,
      metadata: { priority: "high" },
      vote_count: 0,
      created_at: daysAgo(12),
      assigned_to: userId,
    },
    {
      key: "roadmap-alert-routing",
      title: "Watch-based alert routing for comments and status changes",
      description:
        "Only notify users watching an item while keeping notification center clean.",
      status: statusRoadmapProgress,
      type: typeFeature,
      metadata: { priority: "high" },
      vote_count: 0,
      created_at: daysAgo(9),
      assigned_to: userId,
    },
    {
      key: "roadmap-kanban",
      title: "Roadmap board upgraded to Kanban workflow",
      description:
        "Roadmap view moved from list to board with owner/admin drag controls.",
      status: statusRoadmapShipped,
      type: typeImprovement,
      metadata: { priority: "medium" },
      vote_count: 0,
      created_at: daysAgo(5),
      assigned_to: userId,
    },
    {
      key: "changelog-alerts",
      title: "Item watching and alerts are now live",
      description:
        "Users can watch items, get alert indicators, and review historical alerts from a dedicated Alerts page.",
      status: statusChangelogPublished,
      type: typeAnnouncement,
      metadata: { announcement_type: "release" },
      vote_count: 0,
      created_at: daysAgo(4),
      assigned_to: userId,
      visibility: "public",
    },
    {
      key: "changelog-billing-gate",
      title: "Workspace billing gate + Stripe-first checkout",
      description:
        "Access now requires active or trialing billing, with direct portal/checkout handling for owners.",
      status: statusChangelogPublished,
      type: typeAnnouncement,
      metadata: { announcement_type: "announcement" },
      vote_count: 0,
      created_at: daysAgo(2),
      assigned_to: userId,
      visibility: "public",
    },
  ];

  return items.map((item) => ({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    title: item.title,
    description: item.description,
    status_id: item.status.id,
    group_key: item.status.group_key,
    status_key: item.status.status_key,
    item_type_id: item.type.id,
    metadata: item.metadata,
    visibility: item.visibility || "public",
    vote_count: item.vote_count || 0,
    submitter_id: userId,
    submitter_email: userEmail,
    assigned_to: item.assigned_to || null,
    tags: [],
    created_at: item.created_at,
    updated_at: item.created_at,
    _demo_key: item.key,
  }));
}

function buildDemoActivities({ workspaceId, userId, itemsByKey }) {
  const rows = [];

  Object.values(itemsByKey).forEach((item) => {
    rows.push({
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      item_id: item.id,
      activity_type: "system",
      content: "Item created",
      metadata: {},
      author_id: userId,
      author_role: "admin",
      is_internal_note: false,
      created_at: item.created_at,
      updated_at: item.created_at,
    });
  });

  const addComment = (key, content, daysOld) => {
    const item = itemsByKey[key];
    if (!item) return;
    rows.push({
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      item_id: item.id,
      activity_type: "comment",
      content,
      metadata: {},
      author_id: userId,
      author_role: "admin",
      is_internal_note: false,
      created_at: daysAgo(daysOld),
      updated_at: daysAgo(daysOld),
    });
  };

  addComment(
    "feedback-shortcuts",
    "Great candidate for Q2 onboarding improvements. We can scope this as phase one for power users.",
    14
  );
  addComment(
    "feedback-sso-bug",
    "Issue reproduced internally. Root cause appears to be tenant slug length validation.",
    12
  );
  addComment(
    "roadmap-alert-routing",
    "Design approved. Backend and UI rollout are being developed in parallel.",
    7
  );
  addComment(
    "changelog-alerts",
    "Shipped with watch toggles in both list cards and item detail.",
    3
  );

  return rows;
}

async function seedWorkspaceData(adminClient, workspaceId, targetUser) {
  await clearDemoData(adminClient, workspaceId);

  const config = await ensureStatusAndTypeConfig(adminClient, workspaceId);
  const itemRows = buildDemoItemRows({
    workspaceId,
    userId: targetUser.id,
    userEmail: TARGET_EMAIL,
    pickStatus: config.pickStatus,
    pickType: config.pickType,
  });

  const { data: insertedItems, error: insertItemsError } = await adminClient
    .from("items")
    .insert(itemRows.map(({ _demo_key, ...row }) => row))
    .select("id, title, created_at");
  if (insertItemsError) throw insertItemsError;

  const itemsByKey = {};
  itemRows.forEach((row) => {
    const inserted = (insertedItems || []).find((item) => item.title === row.title);
    if (!inserted) return;
    itemsByKey[row._demo_key] = {
      id: inserted.id,
      title: inserted.title,
      created_at: inserted.created_at || row.created_at,
    };
  });

  const activityRows = buildDemoActivities({
    workspaceId,
    userId: targetUser.id,
    itemsByKey,
  });

  const { data: insertedActivities, error: activitiesError } = await adminClient
    .from("item_activities")
    .insert(activityRows)
    .select("id, item_id, activity_type");
  if (activitiesError) throw activitiesError;

  const watchedItems = [
    itemsByKey["feedback-shortcuts"]?.id,
    itemsByKey["feedback-sso-bug"]?.id,
    itemsByKey["roadmap-alert-routing"]?.id,
  ].filter(Boolean);

  if (watchedItems.length > 0) {
    const watcherRows = watchedItems.map((itemId) => ({
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      item_id: itemId,
      user_id: targetUser.id,
    }));
    const { error: watcherError } = await adminClient
      .from("item_watchers")
      .insert(watcherRows);
    if (watcherError) throw watcherError;
  }

  const reactionRows = [
    { item: "feedback-shortcuts", emoji: "👍" },
    { item: "feedback-shortcuts", emoji: "🔥" },
    { item: "roadmap-kanban", emoji: "🚀" },
    { item: "changelog-alerts", emoji: "🎉" },
  ]
    .map((row) => {
      const itemId = itemsByKey[row.item]?.id;
      if (!itemId) return null;
      return {
        id: crypto.randomUUID(),
        workspace_id: workspaceId,
        item_id: itemId,
        user_id: targetUser.id,
        emoji: row.emoji,
      };
    })
    .filter(Boolean);

  if (reactionRows.length > 0) {
    const { error: reactionError } = await adminClient
      .from("item_reactions")
      .insert(reactionRows);
    if (reactionError) throw reactionError;
  }

  const commentActivities = (insertedActivities || []).filter(
    (activity) => activity.activity_type === "comment"
  );
  if (commentActivities.length > 0) {
    const activityReactions = commentActivities.slice(0, 2).map((activity, index) => ({
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      item_activity_id: activity.id,
      user_id: targetUser.id,
      emoji: index === 0 ? "👍" : "🎯",
    }));
    const { error: activityReactionError } = await adminClient
      .from("item_activity_reactions")
      .insert(activityReactions);
    if (activityReactionError) throw activityReactionError;
  }
}

async function main() {
  loadEnvFile();

  const supabaseUrl =
    process.env.SUPABASE_LOCAL_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE URL or service role key. Set .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log(`Seeding demo workspace '${TARGET_WORKSPACE_SLUG}' for ${TARGET_EMAIL}...`);

  const targetUser = await ensureTargetUser(adminClient);
  const workspace = await ensureWorkspace(adminClient);

  await lockWorkspaceMembership(adminClient, workspace.id, targetUser);
  await ensureBillingAccess(adminClient, workspace.id);
  await seedWorkspaceData(adminClient, workspace.id, targetUser);

  console.log("Done.");
  console.log(`Workspace: ${workspace.name} (${workspace.slug})`);
  console.log(`Workspace ID: ${workspace.id}`);
  console.log(`Owner-only member: ${TARGET_EMAIL}`);
}

main().catch((error) => {
  console.error("seed_acme_demo failed:", error);
  process.exit(1);
});

