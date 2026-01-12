-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Updated-at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived'))
);

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0f172a',
  visibility TEXT DEFAULT 'restricted' CHECK (visibility IN ('public', 'restricted')),
  support_enabled BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  is_tenant_admin BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'invited')),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_email ON tenant_members(email);

CREATE TABLE workspace_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'contributor', 'support', 'admin')),
  assigned_via TEXT DEFAULT 'explicit' CHECK (assigned_via IN ('explicit', 'rule')),
  rule_id UUID,
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_workspace_roles_email ON workspace_roles(email);

CREATE TABLE access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pattern TEXT NOT NULL,
  pattern_type TEXT DEFAULT 'domain' CHECK (pattern_type IN ('domain', 'substring', 'exact')),
  default_role TEXT DEFAULT 'viewer' CHECK (default_role IN ('viewer', 'contributor')),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (workspace_id, pattern)
);

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature_request', 'improvement', 'question')),
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  environment JSONB,
  attachments JSONB,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'planned', 'in_progress', 'completed', 'closed', 'declined')),
  tags TEXT[] DEFAULT '{}'::text[],
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  roadmap_item_ids UUID[] DEFAULT '{}'::uuid[],
  changelog_entry_ids UUID[] DEFAULT '{}'::uuid[],
  doc_page_ids UUID[] DEFAULT '{}'::uuid[],
  vote_count INTEGER DEFAULT 0,
  submitter_id UUID NOT NULL,
  submitter_email TEXT,
  assigned_to UUID
);

CREATE INDEX idx_feedback_workspace ON feedback(workspace_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_visibility ON feedback(visibility);

CREATE TABLE feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content TEXT NOT NULL,
  is_official BOOLEAN DEFAULT FALSE,
  author_id UUID NOT NULL,
  author_role TEXT CHECK (author_role IN ('user', 'support', 'admin')),
  attachments JSONB
);

CREATE INDEX idx_feedback_responses_feedback ON feedback_responses(feedback_id);

CREATE TABLE roadmap_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'shipped')),
  target_date DATE,
  target_quarter TEXT,
  linked_feedback_ids UUID[] DEFAULT '{}'::uuid[],
  changelog_entry_ids UUID[] DEFAULT '{}'::uuid[],
  doc_page_ids UUID[] DEFAULT '{}'::uuid[],
  tags TEXT[] DEFAULT '{}'::text[],
  display_order INTEGER DEFAULT 0,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'internal'))
);

CREATE INDEX idx_roadmap_items_workspace ON roadmap_items(workspace_id);
CREATE INDEX idx_roadmap_items_status ON roadmap_items(status);

CREATE TABLE roadmap_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_item_id UUID NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  update_type TEXT DEFAULT 'progress' CHECK (update_type IN ('progress', 'status_change', 'announcement'))
);

CREATE INDEX idx_roadmap_updates_item ON roadmap_updates(roadmap_item_id);

CREATE TABLE support_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'awaiting_user', 'awaiting_support', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  requester_id UUID NOT NULL,
  requester_email TEXT,
  assigned_to UUID,
  participants UUID[] DEFAULT '{}'::uuid[],
  feedback_ids UUID[] DEFAULT '{}'::uuid[],
  roadmap_item_ids UUID[] DEFAULT '{}'::uuid[],
  changelog_entry_ids UUID[] DEFAULT '{}'::uuid[],
  doc_page_ids UUID[] DEFAULT '{}'::uuid[],
  tags TEXT[] DEFAULT '{}'::text[],
  last_message_at TIMESTAMP WITH TIME ZONE,
  message_count INTEGER DEFAULT 0
);

CREATE INDEX idx_support_threads_workspace ON support_threads(workspace_id);
CREATE INDEX idx_support_threads_status ON support_threads(status);

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  author_email TEXT,
  is_internal_note BOOLEAN DEFAULT FALSE,
  is_staff_reply BOOLEAN DEFAULT FALSE,
  attachments JSONB
);

CREATE INDEX idx_support_messages_thread ON support_messages(thread_id);

CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  permissions TEXT[] NOT NULL,
  rate_limit INTEGER DEFAULT 1000,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL
);

CREATE UNIQUE INDEX idx_api_tokens_prefix ON api_tokens(token_prefix);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actor_id UUID NOT NULL,
  actor_email TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'feedback.create',
    'feedback.update',
    'feedback.delete',
    'roadmap.create',
    'roadmap.update',
    'roadmap.delete',
    'roadmap.status_change',
    'support.create',
    'support.reply',
    'support.status_change',
    'access.grant',
    'access.revoke',
    'access.role_change',
    'api_token.create',
    'api_token.revoke',
    'settings.update'
  )),
  entity_type TEXT,
  entity_id UUID,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_audit_logs_workspace ON audit_logs(workspace_id);

CREATE TABLE changelog_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  roadmap_item_ids UUID[] DEFAULT '{}'::uuid[],
  feedback_ids UUID[] DEFAULT '{}'::uuid[],
  doc_page_ids UUID[] DEFAULT '{}'::uuid[],
  title TEXT NOT NULL,
  description TEXT,
  release_date DATE NOT NULL,
  tags TEXT[] DEFAULT '{}'::text[],
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'internal'))
);

CREATE INDEX idx_changelog_entries_workspace ON changelog_entries(workspace_id);

CREATE TABLE doc_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES doc_pages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT,
  content_type TEXT DEFAULT 'markdown' CHECK (content_type IN ('markdown', 'html')),
  feedback_ids UUID[] DEFAULT '{}'::uuid[],
  roadmap_item_ids UUID[] DEFAULT '{}'::uuid[],
  changelog_entry_ids UUID[] DEFAULT '{}'::uuid[],
  "order" INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  type TEXT DEFAULT 'page' CHECK (type IN ('directory', 'page')),
  UNIQUE (workspace_id, slug)
);

CREATE INDEX idx_doc_pages_workspace ON doc_pages(workspace_id);

CREATE TABLE doc_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  doc_page_id UUID NOT NULL REFERENCES doc_pages(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  author_email TEXT,
  is_question BOOLEAN DEFAULT TRUE,
  is_answered BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_doc_comments_page ON doc_comments(doc_page_id);

CREATE TABLE doc_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  changelog_entry_id UUID NOT NULL REFERENCES changelog_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'docs_exist', 'docs_created')),
  doc_page_ids UUID[] DEFAULT '{}'::uuid[]
);

CREATE TABLE waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT,
  notes TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'contacted'))
);

CREATE UNIQUE INDEX idx_waitlist_signups_email ON waitlist_signups(email);

-- Updated-at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_members_updated_at BEFORE UPDATE ON tenant_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workspace_roles_updated_at BEFORE UPDATE ON workspace_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_access_rules_updated_at BEFORE UPDATE ON access_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feedback_responses_updated_at BEFORE UPDATE ON feedback_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roadmap_items_updated_at BEFORE UPDATE ON roadmap_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roadmap_updates_updated_at BEFORE UPDATE ON roadmap_updates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_threads_updated_at BEFORE UPDATE ON support_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_messages_updated_at BEFORE UPDATE ON support_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_tokens_updated_at BEFORE UPDATE ON api_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_audit_logs_updated_at BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_changelog_entries_updated_at BEFORE UPDATE ON changelog_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doc_pages_updated_at BEFORE UPDATE ON doc_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doc_comments_updated_at BEFORE UPDATE ON doc_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doc_queue_updated_at BEFORE UPDATE ON doc_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_waitlist_signups_updated_at BEFORE UPDATE ON waitlist_signups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
