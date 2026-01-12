-- Rename core tables
ALTER TABLE workspaces RENAME TO boards;
ALTER TABLE workspace_roles RENAME TO board_roles;
ALTER TABLE access_rules RENAME TO board_access_rules;

-- Drop legacy policies that depend on tenant_id before removing it
DROP POLICY IF EXISTS workspaces_select_public_or_member ON boards;
DROP POLICY IF EXISTS workspaces_insert_tenant_admins ON boards;
DROP POLICY IF EXISTS workspaces_update_admins ON boards;
DROP POLICY IF EXISTS workspaces_delete_admins ON boards;

DROP POLICY IF EXISTS workspace_roles_select_self_or_admin ON board_roles;
DROP POLICY IF EXISTS workspace_roles_insert_admins ON board_roles;
DROP POLICY IF EXISTS workspace_roles_update_admins ON board_roles;
DROP POLICY IF EXISTS workspace_roles_delete_admins ON board_roles;

DROP POLICY IF EXISTS access_rules_admin_select ON board_access_rules;
DROP POLICY IF EXISTS access_rules_admin_write ON board_access_rules;

DROP POLICY IF EXISTS feedback_select_public_or_member ON feedback;
DROP POLICY IF EXISTS feedback_insert_authenticated ON feedback;
DROP POLICY IF EXISTS feedback_update_staff ON feedback;
DROP POLICY IF EXISTS feedback_delete_admin ON feedback;

DROP POLICY IF EXISTS feedback_responses_select_public_or_member ON feedback_responses;
DROP POLICY IF EXISTS feedback_responses_update_staff ON feedback_responses;
DROP POLICY IF EXISTS feedback_responses_delete_admin ON feedback_responses;

DROP POLICY IF EXISTS roadmap_items_select_public_or_member ON roadmap_items;
DROP POLICY IF EXISTS roadmap_items_write_staff ON roadmap_items;

DROP POLICY IF EXISTS roadmap_updates_select_public_or_member ON roadmap_updates;
DROP POLICY IF EXISTS roadmap_updates_write_staff ON roadmap_updates;

DROP POLICY IF EXISTS support_threads_select_participants ON support_threads;
DROP POLICY IF EXISTS support_threads_insert_authenticated ON support_threads;
DROP POLICY IF EXISTS support_threads_update_staff ON support_threads;
DROP POLICY IF EXISTS support_threads_delete_admin ON support_threads;

DROP POLICY IF EXISTS support_messages_select_participants ON support_messages;
DROP POLICY IF EXISTS support_messages_insert_authorized ON support_messages;
DROP POLICY IF EXISTS support_messages_update_staff_or_author ON support_messages;
DROP POLICY IF EXISTS support_messages_delete_admin ON support_messages;

DROP POLICY IF EXISTS api_tokens_admin_only ON api_tokens;
DROP POLICY IF EXISTS audit_logs_admin_only ON audit_logs;

DROP POLICY IF EXISTS changelog_entries_select_public_or_member ON changelog_entries;
DROP POLICY IF EXISTS changelog_entries_write_staff ON changelog_entries;

DROP POLICY IF EXISTS doc_pages_select_public_or_member ON doc_pages;
DROP POLICY IF EXISTS doc_pages_write_staff ON doc_pages;

DROP POLICY IF EXISTS doc_comments_select_public_or_member ON doc_comments;
DROP POLICY IF EXISTS doc_comments_insert_authenticated ON doc_comments;
DROP POLICY IF EXISTS doc_comments_update_author_or_staff ON doc_comments;
DROP POLICY IF EXISTS doc_comments_delete_admin ON doc_comments;

DROP POLICY IF EXISTS doc_queue_staff_only ON doc_queue;

DROP POLICY IF EXISTS tenants_insert_authenticated ON tenants;
DROP POLICY IF EXISTS tenants_select_members ON tenants;
DROP POLICY IF EXISTS tenants_update_admins ON tenants;
DROP POLICY IF EXISTS tenants_delete_admins ON tenants;

DROP POLICY IF EXISTS tenant_members_select_self_or_admin ON tenant_members;
DROP POLICY IF EXISTS tenant_members_insert_self_or_bootstrap ON tenant_members;
DROP POLICY IF EXISTS tenant_members_update_self_or_admin ON tenant_members;
DROP POLICY IF EXISTS tenant_members_delete_admin ON tenant_members;

DROP POLICY IF EXISTS waitlist_signups_select_admin ON waitlist_signups;
DROP POLICY IF EXISTS waitlist_signups_update_admin ON waitlist_signups;
DROP POLICY IF EXISTS waitlist_signups_delete_admin ON waitlist_signups;

-- Drop tenant linkage and constraints
ALTER TABLE boards DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE boards DROP CONSTRAINT IF EXISTS workspaces_tenant_id_slug_key;
ALTER TABLE boards ADD CONSTRAINT boards_slug_key UNIQUE (slug);

-- Rename foreign key columns to board_id
ALTER TABLE board_roles RENAME COLUMN workspace_id TO board_id;
ALTER TABLE board_access_rules RENAME COLUMN workspace_id TO board_id;
ALTER TABLE feedback RENAME COLUMN workspace_id TO board_id;
ALTER TABLE feedback_responses RENAME COLUMN workspace_id TO board_id;
ALTER TABLE roadmap_items RENAME COLUMN workspace_id TO board_id;
ALTER TABLE roadmap_updates RENAME COLUMN workspace_id TO board_id;
ALTER TABLE support_threads RENAME COLUMN workspace_id TO board_id;
ALTER TABLE support_messages RENAME COLUMN workspace_id TO board_id;
ALTER TABLE api_tokens RENAME COLUMN workspace_id TO board_id;
ALTER TABLE audit_logs RENAME COLUMN workspace_id TO board_id;
ALTER TABLE changelog_entries RENAME COLUMN workspace_id TO board_id;
ALTER TABLE doc_pages RENAME COLUMN workspace_id TO board_id;
ALTER TABLE doc_comments RENAME COLUMN workspace_id TO board_id;
ALTER TABLE doc_queue RENAME COLUMN workspace_id TO board_id;

-- Update unique constraints for renamed tables
ALTER TABLE board_roles DROP CONSTRAINT IF EXISTS workspace_roles_workspace_id_user_id_key;
ALTER TABLE board_roles ADD CONSTRAINT board_roles_board_id_user_id_key UNIQUE (board_id, user_id);

ALTER TABLE board_access_rules DROP CONSTRAINT IF EXISTS access_rules_workspace_id_pattern_key;
ALTER TABLE board_access_rules ADD CONSTRAINT board_access_rules_board_id_pattern_key UNIQUE (board_id, pattern);

-- Drop tenant tables
DROP TABLE IF EXISTS tenant_members;
DROP TABLE IF EXISTS tenants;
