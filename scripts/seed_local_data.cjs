const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const contents = fs.readFileSync(envPath, 'utf8');
  contents.split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith('#')) return;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) return;
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

const supabaseUrl =
  process.env.SUPABASE_LOCAL_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const anonKey =
  process.env.SUPABASE_LOCAL_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase URL or service role key in .env.local.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const anonClient = anonKey
  ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  : null;

const devUser = {
  email: 'dev@localhost.com',
  password: 'dev123456',
  metadata: {
    first_name: 'Development',
    last_name: 'User',
    full_name: 'Development User',
    role: 'admin',
  },
};

const now = new Date();
const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
const randomId = () => crypto.randomUUID();

async function getDevUserId() {
  if (anonClient) {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: devUser.email,
      password: devUser.password,
    });
    if (!error && data?.user?.id) {
      return data.user.id;
    }
  }

  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email: devUser.email,
    password: devUser.password,
    email_confirm: true,
    user_metadata: devUser.metadata,
  });

  if (createError && !createError.message?.includes('already registered')) {
    throw createError;
  }

  if (createData?.user?.id) {
    return createData.user.id;
  }

  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw listError;

  const match = listData?.users?.find((user) => user.email === devUser.email);
  if (!match) {
    throw new Error('Unable to find or create dev user.');
  }
  return match.id;
}

async function deleteAll(table) {
  const { error } = await adminClient
    .from(table)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

async function main() {
  const devUserId = await getDevUserId();

  console.log('Clearing existing data...');
  await deleteAll('item_activities');
  await deleteAll('items');
  await deleteAll('item_statuses');
  await deleteAll('item_status_groups');
  await deleteAll('workspace_access_codes');
  await deleteAll('workspace_access_rules');
  await deleteAll('workspace_roles');
  await deleteAll('api_tokens');
  await deleteAll('audit_logs');
  await deleteAll('billing_services');
  await deleteAll('billing_customers');
  await deleteAll('workspaces');

  const workspaceA = randomId();
  const workspaceB = randomId();

  const workspaces = [
    {
      id: workspaceA,
      name: 'Brightside',
      slug: 'brightside',
      description: 'Customer voice for a productivity platform.',
      primary_color: '#0f172a',
      visibility: 'public',
      settings: { allow_attachments: true },
      status: 'active',
      created_at: daysAgo(30),
    },
    {
      id: workspaceB,
      name: 'Orchard Labs',
      slug: 'orchard-labs',
      description: 'Internal planning workspace.',
      primary_color: '#1e293b',
      visibility: 'restricted',
      settings: { allow_attachments: true },
      status: 'active',
      created_at: daysAgo(14),
    },
  ];

  console.log('Seeding workspaces...');
  const { error: workspaceError } = await adminClient.from('workspaces').insert(workspaces);
  if (workspaceError) throw workspaceError;

  const roles = [
    {
      id: randomId(),
      workspace_id: workspaceA,
      user_id: devUserId,
      email: devUser.email,
      role: 'admin',
      assigned_via: 'explicit',
      created_at: daysAgo(30),
    },
    {
      id: randomId(),
      workspace_id: workspaceB,
      user_id: devUserId,
      email: devUser.email,
      role: 'admin',
      assigned_via: 'explicit',
      created_at: daysAgo(14),
    },
  ];

  console.log('Seeding workspace roles...');
  const { error: roleError } = await adminClient.from('workspace_roles').insert(roles);
  if (roleError) throw roleError;

  await adminClient.rpc('seed_default_item_statuses', { target_workspace_id: workspaceA });
  await adminClient.rpc('seed_default_item_statuses', { target_workspace_id: workspaceB });

  const sampleItems = [
    {
      id: randomId(),
      workspace_id: workspaceA,
      group_key: 'feedback',
      status_key: 'open',
      title: 'Allow keyboard shortcuts for triage',
      description: 'Power users need quick status changes without leaving the list view.',
      metadata: { type: 'feature_request', priority: 'high' },
      visibility: 'public',
      submitter_id: devUserId,
      submitter_email: devUser.email,
      vote_count: 8,
      created_at: daysAgo(6),
    },
    {
      id: randomId(),
      workspace_id: workspaceA,
      group_key: 'roadmap',
      status_key: 'in_progress',
      title: 'Workspace-level API token scopes',
      description: 'Introduce scoped API tokens with granular permissions.',
      metadata: { priority: 'medium' },
      visibility: 'public',
      submitter_id: devUserId,
      submitter_email: devUser.email,
      vote_count: 3,
      created_at: daysAgo(4),
    },
    {
      id: randomId(),
      workspace_id: workspaceB,
      group_key: 'changelog',
      status_key: 'published',
      title: 'Introduced unified item threads',
      description: 'Initial posts now render as the first entry in discussion threads.',
      metadata: { announcement_type: 'release' },
      visibility: 'internal',
      submitter_id: devUserId,
      submitter_email: devUser.email,
      vote_count: 0,
      created_at: daysAgo(2),
    },
  ];

  console.log('Seeding items...');
  const { error: itemError } = await adminClient.from('items').insert(sampleItems);
  if (itemError) throw itemError;

  const activities = sampleItems.flatMap((item) => [
    {
      id: randomId(),
      workspace_id: item.workspace_id,
      item_id: item.id,
      activity_type: 'system',
      content: 'Item created',
      metadata: {},
      author_id: devUserId,
      author_role: 'admin',
      is_internal_note: false,
      created_at: item.created_at,
    },
    {
      id: randomId(),
      workspace_id: item.workspace_id,
      item_id: item.id,
      activity_type: 'comment',
      content: 'Seeded example discussion comment.',
      metadata: {},
      author_id: devUserId,
      author_role: 'admin',
      is_internal_note: false,
      created_at: daysAgo(1),
    },
  ]);

  console.log('Seeding item activities...');
  const { error: activityError } = await adminClient.from('item_activities').insert(activities);
  if (activityError) throw activityError;

  const billingRows = [
    { workspace_id: workspaceA, service: 'feedback', enabled: true },
    { workspace_id: workspaceA, service: 'roadmap', enabled: true },
    { workspace_id: workspaceA, service: 'changelog', enabled: true },
    { workspace_id: workspaceB, service: 'feedback', enabled: true },
    { workspace_id: workspaceB, service: 'roadmap', enabled: false },
    { workspace_id: workspaceB, service: 'changelog', enabled: false },
  ];

  console.log('Seeding billing services...');
  const { error: billingError } = await adminClient.from('billing_services').insert(billingRows);
  if (billingError) throw billingError;

  console.log('Done. Local data seeded successfully.');
  console.log(`Dev user: ${devUser.email} / ${devUser.password}`);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
