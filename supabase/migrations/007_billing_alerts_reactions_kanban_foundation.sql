BEGIN;

-- Expand activity types for richer change tracking.
ALTER TABLE public.item_activities
  DROP CONSTRAINT IF EXISTS item_activities_activity_type_check;

ALTER TABLE public.item_activities
  ADD CONSTRAINT item_activities_activity_type_check
  CHECK (
    activity_type IN (
      'comment',
      'update',
      'status_change',
      'group_change',
      'type_change',
      'priority_change',
      'assignee_change',
      'system'
    )
  );

-- Item watchers for alert subscriptions.
CREATE TABLE IF NOT EXISTS public.item_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_item_watchers_workspace_user
  ON public.item_watchers(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_item_watchers_item
  ON public.item_watchers(item_id);

-- Emoji reactions on items.
CREATE TABLE IF NOT EXISTS public.item_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, item_id, user_id, emoji),
  CHECK (char_length(emoji) BETWEEN 1 AND 16)
);

CREATE INDEX IF NOT EXISTS idx_item_reactions_workspace_item
  ON public.item_reactions(workspace_id, item_id);
CREATE INDEX IF NOT EXISTS idx_item_reactions_workspace_user
  ON public.item_reactions(workspace_id, user_id);

-- Emoji reactions on comment activities.
CREATE TABLE IF NOT EXISTS public.item_activity_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_activity_id UUID NOT NULL REFERENCES public.item_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, item_activity_id, user_id, emoji),
  CHECK (char_length(emoji) BETWEEN 1 AND 16)
);

CREATE INDEX IF NOT EXISTS idx_item_activity_reactions_workspace_activity
  ON public.item_activity_reactions(workspace_id, item_activity_id);
CREATE INDEX IF NOT EXISTS idx_item_activity_reactions_workspace_user
  ON public.item_activity_reactions(workspace_id, user_id);

-- Workspace-scoped user alerts.
CREATE TABLE IF NOT EXISTS public.user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_activity_id UUID REFERENCES public.item_activities(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('comment', 'status_change', 'type_change', 'priority_change', 'assignee_change')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_alerts_workspace_user_created
  ON public.user_alerts(workspace_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_alerts_workspace_user_unread
  ON public.user_alerts(workspace_id, user_id, is_read);

-- Enable RLS on newly introduced tables.
ALTER TABLE public.item_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_activity_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS item_watchers_select_readable ON public.item_watchers;
CREATE POLICY item_watchers_select_readable ON public.item_watchers
  FOR SELECT USING (public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner']));

DROP POLICY IF EXISTS item_watchers_write_member ON public.item_watchers;
CREATE POLICY item_watchers_write_member ON public.item_watchers
  FOR ALL USING (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS item_reactions_select_readable ON public.item_reactions;
CREATE POLICY item_reactions_select_readable ON public.item_reactions
  FOR SELECT USING (public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner']));

DROP POLICY IF EXISTS item_reactions_write_member ON public.item_reactions;
CREATE POLICY item_reactions_write_member ON public.item_reactions
  FOR ALL USING (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS item_activity_reactions_select_readable ON public.item_activity_reactions;
CREATE POLICY item_activity_reactions_select_readable ON public.item_activity_reactions
  FOR SELECT USING (public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner']));

DROP POLICY IF EXISTS item_activity_reactions_write_member ON public.item_activity_reactions;
CREATE POLICY item_activity_reactions_write_member ON public.item_activity_reactions
  FOR ALL USING (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS user_alerts_select_self ON public.user_alerts;
CREATE POLICY user_alerts_select_self ON public.user_alerts
  FOR SELECT USING (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS user_alerts_update_self ON public.user_alerts;
CREATE POLICY user_alerts_update_self ON public.user_alerts
  FOR UPDATE USING (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
    AND user_id = auth.uid()
  );

-- Tighten contributor mutation constraints for system-managed fields.
CREATE OR REPLACE FUNCTION public.enforce_contributor_item_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  is_admin_or_owner BOOLEAN;
  is_contributor BOOLEAN;
  default_feedback_status_id UUID;
  default_item_type_id UUID;
BEGIN
  IF auth.role() = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  is_admin_or_owner := public.has_workspace_role(COALESCE(NEW.workspace_id, OLD.workspace_id), ARRAY['admin', 'owner']);
  IF is_admin_or_owner THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  is_contributor := public.has_workspace_role(COALESCE(NEW.workspace_id, OLD.workspace_id), ARRAY['contributor']);
  IF NOT is_contributor THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.group_key <> 'feedback' THEN
      RAISE EXCEPTION 'Contributors can only create feedback items' USING ERRCODE = '42501';
    END IF;

    IF NEW.submitter_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Contributors can only create their own feedback items' USING ERRCODE = '42501';
    END IF;

    IF NEW.assigned_to IS NOT NULL THEN
      RAISE EXCEPTION 'Contributors cannot assign feedback items' USING ERRCODE = '42501';
    END IF;

    SELECT s.id
    INTO default_feedback_status_id
    FROM public.item_statuses s
    WHERE s.workspace_id = NEW.workspace_id
      AND s.group_key = 'feedback'
      AND s.is_active = TRUE
    ORDER BY s.display_order ASC, s.created_at ASC
    LIMIT 1;

    IF default_feedback_status_id IS NOT NULL AND NEW.status_id IS DISTINCT FROM default_feedback_status_id THEN
      RAISE EXCEPTION 'Contributors cannot set item status' USING ERRCODE = '42501';
    END IF;

    SELECT t.id
    INTO default_item_type_id
    FROM public.item_types t
    WHERE t.workspace_id = NEW.workspace_id
      AND t.is_active = TRUE
    ORDER BY t.display_order ASC, t.created_at ASC
    LIMIT 1;

    IF default_item_type_id IS NOT NULL AND NEW.item_type_id IS DISTINCT FROM default_item_type_id THEN
      RAISE EXCEPTION 'Contributors cannot set item type' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.submitter_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Contributors can only edit their own feedback items' USING ERRCODE = '42501';
    END IF;

    IF OLD.group_key <> 'feedback' OR NEW.group_key <> 'feedback' THEN
      RAISE EXCEPTION 'Contributors cannot move non-feedback items' USING ERRCODE = '42501';
    END IF;

    IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
      RAISE EXCEPTION 'Contributors cannot change item status' USING ERRCODE = '42501';
    END IF;

    IF NEW.item_type_id IS DISTINCT FROM OLD.item_type_id THEN
      RAISE EXCEPTION 'Contributors cannot change item type' USING ERRCODE = '42501';
    END IF;

    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      RAISE EXCEPTION 'Contributors cannot change assignee' USING ERRCODE = '42501';
    END IF;

    IF NEW.title IS DISTINCT FROM OLD.title THEN
      RAISE EXCEPTION 'Contributors cannot change item title' USING ERRCODE = '42501';
    END IF;

    IF NEW.metadata IS DISTINCT FROM OLD.metadata THEN
      RAISE EXCEPTION 'Contributors cannot change item metadata' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.submitter_id IS DISTINCT FROM auth.uid() OR OLD.group_key <> 'feedback' THEN
      RAISE EXCEPTION 'Contributors can only delete their own feedback items' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
