BEGIN;

-- Status groups: fixed canonical names + color support.
ALTER TABLE public.item_status_groups
  ADD COLUMN IF NOT EXISTS color_hex TEXT;

UPDATE public.item_status_groups
SET color_hex = CASE group_key
  WHEN 'feedback' THEN '#2563EB'
  WHEN 'roadmap' THEN '#7C3AED'
  WHEN 'changelog' THEN '#059669'
  ELSE '#0F172A'
END
WHERE color_hex IS NULL OR color_hex = '';

ALTER TABLE public.item_status_groups
  ALTER COLUMN color_hex SET NOT NULL;

ALTER TABLE public.item_status_groups
  ADD CONSTRAINT item_status_groups_color_hex_check
  CHECK (color_hex ~* '^#[0-9A-F]{6}$');

CREATE OR REPLACE FUNCTION public.canonical_item_group_label(target_group_key TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE target_group_key
    WHEN 'feedback' THEN 'Feedback'
    WHEN 'roadmap' THEN 'Roadmap'
    WHEN 'changelog' THEN 'Changelog'
    ELSE 'Items'
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_item_status_group_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.display_name := public.canonical_item_group_label(NEW.group_key);
  IF NEW.color_hex IS NULL OR NEW.color_hex = '' THEN
    NEW.color_hex := CASE NEW.group_key
      WHEN 'feedback' THEN '#2563EB'
      WHEN 'roadmap' THEN '#7C3AED'
      WHEN 'changelog' THEN '#059669'
      ELSE '#0F172A'
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_item_status_group_defaults_trigger ON public.item_status_groups;
CREATE TRIGGER enforce_item_status_group_defaults_trigger
  BEFORE INSERT OR UPDATE ON public.item_status_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_item_status_group_defaults();

UPDATE public.item_status_groups
SET display_name = public.canonical_item_group_label(group_key);

-- Item statuses: internal UUID-like status_key, not user-editable.
UPDATE public.item_statuses
SET status_key = id::text;

ALTER TABLE public.item_statuses
  ALTER COLUMN status_key SET DEFAULT gen_random_uuid()::text;

CREATE OR REPLACE FUNCTION public.prevent_item_status_key_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status_key IS DISTINCT FROM NEW.status_key THEN
    RAISE EXCEPTION 'status_key is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_item_status_key_mutation_trigger ON public.item_statuses;
CREATE TRIGGER prevent_item_status_key_mutation_trigger
  BEFORE UPDATE ON public.item_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_item_status_key_mutation();

-- Global workspace item types.
CREATE TABLE IF NOT EXISTS public.item_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, label)
);

CREATE INDEX IF NOT EXISTS idx_item_types_workspace ON public.item_types(workspace_id);

ALTER TABLE public.item_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS item_types_select_readable ON public.item_types;
CREATE POLICY item_types_select_readable ON public.item_types
  FOR SELECT USING (public.can_read_workspace(workspace_id));

DROP POLICY IF EXISTS item_types_write_admin_owner ON public.item_types;
CREATE POLICY item_types_write_admin_owner ON public.item_types
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

CREATE TRIGGER update_item_types_updated_at
  BEFORE UPDATE ON public.item_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.seed_default_item_types(target_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.item_types (workspace_id, label, display_order, is_active)
  VALUES
    (target_workspace_id, 'Feature Request', 0, TRUE),
    (target_workspace_id, 'Bug', 1, TRUE),
    (target_workspace_id, 'Improvement', 2, TRUE),
    (target_workspace_id, 'Question', 3, TRUE),
    (target_workspace_id, 'Announcement', 4, TRUE)
  ON CONFLICT (workspace_id, label) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_item_statuses(target_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.item_status_groups (workspace_id, group_key, display_name, display_order, color_hex)
  VALUES
    (target_workspace_id, 'feedback', 'Feedback', 0, '#2563EB'),
    (target_workspace_id, 'roadmap', 'Roadmap', 1, '#7C3AED'),
    (target_workspace_id, 'changelog', 'Changelog', 2, '#059669')
  ON CONFLICT (workspace_id, group_key) DO NOTHING;

  INSERT INTO public.item_statuses (workspace_id, group_key, label, display_order, is_active)
  VALUES
    (target_workspace_id, 'feedback', 'Open', 0, TRUE),
    (target_workspace_id, 'feedback', 'Under review', 1, TRUE),
    (target_workspace_id, 'feedback', 'Planned', 2, TRUE),
    (target_workspace_id, 'feedback', 'In progress', 3, TRUE),
    (target_workspace_id, 'feedback', 'Completed', 4, TRUE),
    (target_workspace_id, 'feedback', 'Closed', 5, TRUE),
    (target_workspace_id, 'roadmap', 'Planned', 0, TRUE),
    (target_workspace_id, 'roadmap', 'In progress', 1, TRUE),
    (target_workspace_id, 'roadmap', 'Shipped', 2, TRUE),
    (target_workspace_id, 'changelog', 'Published', 0, TRUE)
  ON CONFLICT DO NOTHING;
END;
$$;

DO $$
DECLARE
  target_workspace RECORD;
BEGIN
  FOR target_workspace IN SELECT id FROM public.workspaces LOOP
    PERFORM public.seed_default_item_types(target_workspace.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.seed_default_item_types_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.seed_default_item_types(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_item_types_after_workspace_insert ON public.workspaces;
CREATE TRIGGER seed_item_types_after_workspace_insert
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_item_types_trigger();

CREATE OR REPLACE FUNCTION public.enforce_item_types_minimum()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  active_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT COUNT(*) INTO active_count
    FROM public.item_types
    WHERE workspace_id = OLD.workspace_id
      AND id <> OLD.id
      AND is_active = TRUE;

    IF active_count <= 0 THEN
      RAISE EXCEPTION 'Each workspace must keep at least one active item type' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    SELECT COUNT(*) INTO active_count
    FROM public.item_types
    WHERE workspace_id = OLD.workspace_id
      AND id <> OLD.id
      AND is_active = TRUE;

    IF active_count <= 0 THEN
      RAISE EXCEPTION 'Each workspace must keep at least one active item type' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_item_types_minimum_trigger ON public.item_types;
CREATE TRIGGER enforce_item_types_minimum_trigger
  BEFORE UPDATE OR DELETE ON public.item_types
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_item_types_minimum();

-- Move item status linkage to status UUID.
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS status_id UUID,
  ADD COLUMN IF NOT EXISTS item_type_id UUID;

UPDATE public.items i
SET status_id = s.id
FROM public.item_statuses s
WHERE i.workspace_id = s.workspace_id
  AND i.group_key = s.group_key
  AND i.status_key = s.status_key
  AND i.status_id IS NULL;

UPDATE public.items i
SET status_id = (
  SELECT s.id
  FROM public.item_statuses s
  WHERE s.workspace_id = i.workspace_id
    AND s.group_key = i.group_key
    AND s.is_active = TRUE
  ORDER BY s.display_order ASC, s.created_at ASC
  LIMIT 1
)
WHERE i.status_id IS NULL;

ALTER TABLE public.items
  ALTER COLUMN status_id SET NOT NULL;

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_workspace_id_group_key_status_key_fkey;

ALTER TABLE public.items
  ADD CONSTRAINT items_status_id_fkey
  FOREIGN KEY (status_id) REFERENCES public.item_statuses(id);

CREATE INDEX IF NOT EXISTS idx_items_status_id ON public.items(status_id);
CREATE INDEX IF NOT EXISTS idx_items_workspace_status_id ON public.items(workspace_id, status_id);

CREATE OR REPLACE FUNCTION public.sync_item_status_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  status_row public.item_statuses%ROWTYPE;
BEGIN
  IF NEW.status_id IS NOT NULL THEN
    SELECT *
    INTO status_row
    FROM public.item_statuses
    WHERE id = NEW.status_id
      AND workspace_id = NEW.workspace_id
    LIMIT 1;

    IF status_row.id IS NULL THEN
      RAISE EXCEPTION 'Invalid status_id for workspace' USING ERRCODE = '23503';
    END IF;

    NEW.group_key := status_row.group_key;
    NEW.status_key := status_row.status_key;
    RETURN NEW;
  END IF;

  IF NEW.group_key IS NOT NULL AND NEW.status_key IS NOT NULL THEN
    SELECT *
    INTO status_row
    FROM public.item_statuses
    WHERE workspace_id = NEW.workspace_id
      AND group_key = NEW.group_key
      AND status_key = NEW.status_key
    LIMIT 1;

    IF status_row.id IS NULL THEN
      RAISE EXCEPTION 'Invalid status reference for workspace/group' USING ERRCODE = '23503';
    END IF;

    NEW.status_id := status_row.id;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'status_id is required';
END;
$$;

DROP TRIGGER IF EXISTS sync_item_status_fields_trigger ON public.items;
CREATE TRIGGER sync_item_status_fields_trigger
  BEFORE INSERT OR UPDATE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_item_status_fields();

UPDATE public.items i
SET item_type_id = t.id
FROM public.item_types t
WHERE i.workspace_id = t.workspace_id
  AND t.label = CASE lower(coalesce(i.metadata->>'type', ''))
    WHEN 'bug' THEN 'Bug'
    WHEN 'feature_request' THEN 'Feature Request'
    WHEN 'improvement' THEN 'Improvement'
    WHEN 'question' THEN 'Question'
    ELSE NULL
  END
  AND i.item_type_id IS NULL;

UPDATE public.items i
SET item_type_id = (
  SELECT t.id
  FROM public.item_types t
  WHERE t.workspace_id = i.workspace_id
    AND t.is_active = TRUE
  ORDER BY t.display_order ASC, t.created_at ASC
  LIMIT 1
)
WHERE i.item_type_id IS NULL;

ALTER TABLE public.items
  ALTER COLUMN item_type_id SET NOT NULL;

ALTER TABLE public.items
  ADD CONSTRAINT items_item_type_id_fkey
  FOREIGN KEY (item_type_id) REFERENCES public.item_types(id);

CREATE INDEX IF NOT EXISTS idx_items_item_type_id ON public.items(item_type_id);

-- Contributor restrictions: cannot assign items and cannot change status by status_id.
CREATE OR REPLACE FUNCTION public.enforce_contributor_item_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  is_admin_or_owner BOOLEAN;
  is_contributor BOOLEAN;
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
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      RAISE EXCEPTION 'Contributors cannot change assignee' USING ERRCODE = '42501';
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
