CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0f172a',
  visibility TEXT DEFAULT 'restricted' CHECK (visibility IN ('public', 'restricted')),
  settings JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'))
);

CREATE TABLE board_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'contributor', 'admin')),
  assigned_via TEXT DEFAULT 'explicit' CHECK (assigned_via IN ('explicit', 'rule', 'access_code')),
  rule_id UUID,
  UNIQUE (board_id, user_id)
);

CREATE INDEX idx_board_roles_email ON board_roles(email);

CREATE TABLE board_access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  pattern TEXT NOT NULL,
  pattern_type TEXT DEFAULT 'domain' CHECK (pattern_type IN ('domain', 'substring', 'exact')),
  default_role TEXT DEFAULT 'viewer' CHECK (default_role IN ('viewer', 'contributor')),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (board_id, pattern)
);

CREATE TABLE item_status_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL CHECK (group_key IN ('feedback', 'roadmap', 'changelog')),
  display_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (board_id, group_key)
);

CREATE TABLE item_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL CHECK (group_key IN ('feedback', 'roadmap', 'changelog')),
  status_key TEXT NOT NULL,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (board_id, group_key, status_key),
  FOREIGN KEY (board_id, group_key) REFERENCES item_status_groups(board_id, group_key) ON DELETE CASCADE
);

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  group_key TEXT NOT NULL CHECK (group_key IN ('feedback', 'roadmap', 'changelog')),
  status_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  tags TEXT[] DEFAULT '{}'::text[],
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal', 'private')),
  vote_count INTEGER NOT NULL DEFAULT 0,
  submitter_id UUID,
  submitter_email TEXT,
  assigned_to UUID,
  FOREIGN KEY (board_id, group_key, status_key)
    REFERENCES item_statuses(board_id, group_key, status_key)
    ON UPDATE CASCADE
);

CREATE INDEX idx_items_board ON items(board_id);
CREATE INDEX idx_items_group ON items(group_key);
CREATE INDEX idx_items_status ON items(status_key);
CREATE INDEX idx_items_board_group_status ON items(board_id, group_key, status_key);
CREATE INDEX idx_items_metadata_gin ON items USING GIN(metadata);

CREATE TABLE item_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('comment', 'update', 'status_change', 'group_change', 'system')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  author_id UUID,
  author_role TEXT CHECK (author_role IN ('user', 'admin')),
  is_internal_note BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_item_activities_item ON item_activities(item_id);
CREATE INDEX idx_item_activities_board ON item_activities(board_id);

CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  permissions TEXT[] NOT NULL,
  rate_limit INTEGER DEFAULT 1000,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_api_tokens_prefix ON api_tokens(token_prefix);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  actor_id UUID NOT NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_audit_logs_board ON audit_logs(board_id);

CREATE OR REPLACE FUNCTION seed_default_item_statuses(target_board_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO item_status_groups (board_id, group_key, display_name, display_order)
  VALUES
    (target_board_id, 'feedback', 'Feedback', 0),
    (target_board_id, 'roadmap', 'Roadmap', 1),
    (target_board_id, 'changelog', 'Changelog', 2)
  ON CONFLICT (board_id, group_key) DO NOTHING;

  INSERT INTO item_statuses (board_id, group_key, status_key, label, display_order, is_active)
  VALUES
    (target_board_id, 'feedback', 'open', 'Open', 0, TRUE),
    (target_board_id, 'feedback', 'under_review', 'Under review', 1, TRUE),
    (target_board_id, 'feedback', 'planned', 'Planned', 2, TRUE),
    (target_board_id, 'feedback', 'in_progress', 'In progress', 3, TRUE),
    (target_board_id, 'feedback', 'completed', 'Completed', 4, TRUE),
    (target_board_id, 'feedback', 'closed', 'Closed', 5, TRUE),
    (target_board_id, 'roadmap', 'planned', 'Planned', 0, TRUE),
    (target_board_id, 'roadmap', 'in_progress', 'In progress', 1, TRUE),
    (target_board_id, 'roadmap', 'shipped', 'Shipped', 2, TRUE),
    (target_board_id, 'changelog', 'published', 'Published', 0, TRUE)
  ON CONFLICT (board_id, group_key, status_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION seed_default_item_statuses_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM seed_default_item_statuses(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_boards_updated_at BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_board_roles_updated_at BEFORE UPDATE ON board_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_board_access_rules_updated_at BEFORE UPDATE ON board_access_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_item_status_groups_updated_at BEFORE UPDATE ON item_status_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_item_statuses_updated_at BEFORE UPDATE ON item_statuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_item_activities_updated_at BEFORE UPDATE ON item_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_tokens_updated_at BEFORE UPDATE ON api_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_audit_logs_updated_at BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER seed_item_statuses_after_board_insert
  AFTER INSERT ON boards
  FOR EACH ROW EXECUTE FUNCTION seed_default_item_statuses_trigger();

SELECT seed_default_item_statuses(id) FROM boards;
