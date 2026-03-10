CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0f172a',
  visibility TEXT NOT NULL DEFAULT 'restricted' CHECK (visibility IN ('public', 'restricted')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
);

CREATE TABLE public.workspace_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'contributor', 'admin')),
  assigned_via TEXT NOT NULL DEFAULT 'explicit' CHECK (assigned_via IN ('explicit', 'rule', 'access_code')),
  rule_id UUID,
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_workspace_roles_workspace_id ON public.workspace_roles(workspace_id);
CREATE INDEX idx_workspace_roles_email ON public.workspace_roles(email);

CREATE TABLE public.workspace_access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pattern TEXT NOT NULL,
  pattern_type TEXT NOT NULL DEFAULT 'domain' CHECK (pattern_type IN ('domain', 'substring', 'exact')),
  default_role TEXT NOT NULL DEFAULT 'viewer' CHECK (default_role IN ('viewer', 'contributor')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (workspace_id, pattern)
);

CREATE TABLE public.workspace_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id)
);

CREATE TABLE public.item_status_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL CHECK (group_key IN ('feedback', 'roadmap', 'changelog')),
  display_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, group_key)
);

CREATE TABLE public.item_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL CHECK (group_key IN ('feedback', 'roadmap', 'changelog')),
  status_key TEXT NOT NULL,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, group_key, status_key),
  FOREIGN KEY (workspace_id, group_key)
    REFERENCES public.item_status_groups(workspace_id, group_key)
    ON DELETE CASCADE
);

CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  group_key TEXT NOT NULL CHECK (group_key IN ('feedback', 'roadmap', 'changelog')),
  status_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal', 'private')),
  vote_count INTEGER NOT NULL DEFAULT 0,
  submitter_id UUID,
  submitter_email TEXT,
  assigned_to UUID,
  FOREIGN KEY (workspace_id, group_key, status_key)
    REFERENCES public.item_statuses(workspace_id, group_key, status_key)
    ON UPDATE CASCADE
);

CREATE INDEX idx_items_workspace ON public.items(workspace_id);
CREATE INDEX idx_items_group ON public.items(group_key);
CREATE INDEX idx_items_status ON public.items(status_key);
CREATE INDEX idx_items_workspace_group_status ON public.items(workspace_id, group_key, status_key);
CREATE INDEX idx_items_metadata_gin ON public.items USING GIN(metadata);

CREATE TABLE public.item_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('comment', 'update', 'status_change', 'group_change', 'system')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  author_id UUID,
  author_role TEXT CHECK (author_role IN ('user', 'admin')),
  is_internal_note BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_item_activities_item ON public.item_activities(item_id);
CREATE INDEX idx_item_activities_workspace ON public.item_activities(workspace_id);

CREATE TABLE public.api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL UNIQUE,
  permissions TEXT[] NOT NULL,
  rate_limit INTEGER NOT NULL DEFAULT 1000,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID NOT NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_audit_logs_workspace ON public.audit_logs(workspace_id);

CREATE TABLE public.billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.billing_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('feedback', 'roadmap', 'changelog')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, service)
);

CREATE OR REPLACE FUNCTION public.seed_default_item_statuses(target_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.item_status_groups (workspace_id, group_key, display_name, display_order)
  VALUES
    (target_workspace_id, 'feedback', 'Feedback', 0),
    (target_workspace_id, 'roadmap', 'Roadmap', 1),
    (target_workspace_id, 'changelog', 'Changelog', 2)
  ON CONFLICT (workspace_id, group_key) DO NOTHING;

  INSERT INTO public.item_statuses (workspace_id, group_key, status_key, label, display_order, is_active)
  VALUES
    (target_workspace_id, 'feedback', 'open', 'Open', 0, TRUE),
    (target_workspace_id, 'feedback', 'under_review', 'Under Review', 1, TRUE),
    (target_workspace_id, 'feedback', 'planned', 'Planned', 2, TRUE),
    (target_workspace_id, 'feedback', 'in_progress', 'In Progress', 3, TRUE),
    (target_workspace_id, 'feedback', 'completed', 'Completed', 4, TRUE),
    (target_workspace_id, 'feedback', 'closed', 'Closed', 5, TRUE),
    (target_workspace_id, 'roadmap', 'planned', 'Planned', 0, TRUE),
    (target_workspace_id, 'roadmap', 'in_progress', 'In Progress', 1, TRUE),
    (target_workspace_id, 'roadmap', 'shipped', 'Shipped', 2, TRUE),
    (target_workspace_id, 'changelog', 'published', 'Published', 0, TRUE)
  ON CONFLICT (workspace_id, group_key, status_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_item_statuses_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.seed_default_item_statuses(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(target_workspace_id UUID, roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_roles wr
    WHERE wr.workspace_id = target_workspace_id
      AND wr.user_id = auth.uid()
      AND wr.role = ANY (roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_workspace(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = target_workspace_id
      AND w.visibility = 'public'
      AND w.status = 'active'
  )
  OR (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.workspace_roles wr
      WHERE wr.workspace_id = target_workspace_id
        AND wr.user_id = auth.uid()
    )
  );
$$;

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workspace_roles_updated_at BEFORE UPDATE ON public.workspace_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workspace_access_rules_updated_at BEFORE UPDATE ON public.workspace_access_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_item_status_groups_updated_at BEFORE UPDATE ON public.item_status_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_item_statuses_updated_at BEFORE UPDATE ON public.item_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_item_activities_updated_at BEFORE UPDATE ON public.item_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_api_tokens_updated_at BEFORE UPDATE ON public.api_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_audit_logs_updated_at BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_billing_customers_updated_at BEFORE UPDATE ON public.billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_billing_services_updated_at BEFORE UPDATE ON public.billing_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER seed_item_statuses_after_workspace_insert
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_item_statuses_trigger();

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_access_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_status_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspaces_select_readable ON public.workspaces
  FOR SELECT USING (public.can_read_workspace(id));

CREATE POLICY workspaces_insert_authenticated ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY workspaces_update_admin ON public.workspaces
  FOR UPDATE USING (public.has_workspace_role(id, ARRAY['admin']))
  WITH CHECK (public.has_workspace_role(id, ARRAY['admin']));

CREATE POLICY workspaces_delete_admin ON public.workspaces
  FOR DELETE USING (public.has_workspace_role(id, ARRAY['admin']));

CREATE POLICY workspace_roles_select_members ON public.workspace_roles
  FOR SELECT USING (public.can_read_workspace(workspace_id));

CREATE POLICY workspace_roles_write_admin ON public.workspace_roles
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin']));

CREATE POLICY workspace_access_rules_admin_only ON public.workspace_access_rules
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin']));

CREATE POLICY workspace_access_codes_no_public_access ON public.workspace_access_codes
  FOR ALL USING (false)
  WITH CHECK (false);

CREATE POLICY item_status_groups_admin_only ON public.item_status_groups
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin']));

CREATE POLICY item_statuses_admin_only ON public.item_statuses
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin']));

CREATE POLICY items_select_readable ON public.items
  FOR SELECT USING (
    public.can_read_workspace(workspace_id)
    AND (
      visibility = 'public'
      OR public.has_workspace_role(workspace_id, ARRAY['viewer', 'contributor', 'admin'])
    )
  );

CREATE POLICY items_insert_contributor ON public.items
  FOR INSERT WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin'])
  );

CREATE POLICY items_update_contributor ON public.items
  FOR UPDATE USING (public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin']));

CREATE POLICY items_delete_admin ON public.items
  FOR DELETE USING (public.has_workspace_role(workspace_id, ARRAY['admin']));

CREATE POLICY item_activities_select_readable ON public.item_activities
  FOR SELECT USING (
    public.can_read_workspace(workspace_id)
    AND (
      is_internal_note = false
      OR public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin'])
    )
  );

CREATE POLICY item_activities_insert_contributor ON public.item_activities
  FOR INSERT WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin'])
  );

CREATE POLICY item_activities_update_admin ON public.item_activities
  FOR UPDATE USING (public.has_workspace_role(workspace_id, ARRAY['admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin']));

CREATE POLICY item_activities_delete_admin ON public.item_activities
  FOR DELETE USING (public.has_workspace_role(workspace_id, ARRAY['admin']));

CREATE POLICY api_tokens_admin_only ON public.api_tokens
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin']));

CREATE POLICY audit_logs_admin_only ON public.audit_logs
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin']));

CREATE POLICY billing_customers_admin_only ON public.billing_customers
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin']));

CREATE POLICY billing_services_admin_only ON public.billing_services
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin']));
