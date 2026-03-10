-- Optional transition script for environments that still have legacy split tables.
-- Safe to run on fresh installs where legacy tables do not exist.

-- Backfill canonical unified schema for older projects where prior migration files
-- were already marked applied before this repository rewrote the migration history.
CREATE TABLE IF NOT EXISTS public.item_status_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL CHECK (group_key IN ('feedback', 'roadmap', 'changelog')),
  display_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (board_id, group_key)
);

CREATE TABLE IF NOT EXISTS public.item_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL CHECK (group_key IN ('feedback', 'roadmap', 'changelog')),
  status_key TEXT NOT NULL,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (board_id, group_key, status_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'item_statuses_board_id_group_key_fkey'
      AND conrelid = 'public.item_statuses'::regclass
  ) THEN
    ALTER TABLE public.item_statuses
      ADD CONSTRAINT item_statuses_board_id_group_key_fkey
      FOREIGN KEY (board_id, group_key)
      REFERENCES public.item_status_groups(board_id, group_key)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
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
  assigned_to UUID
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_board_id_group_key_status_key_fkey'
      AND conrelid = 'public.items'::regclass
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_board_id_group_key_status_key_fkey
      FOREIGN KEY (board_id, group_key, status_key)
      REFERENCES public.item_statuses(board_id, group_key, status_key)
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.item_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('comment', 'update', 'status_change', 'group_change', 'system')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  author_id UUID,
  author_role TEXT CHECK (author_role IN ('user', 'admin')),
  is_internal_note BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_items_board ON public.items(board_id);
CREATE INDEX IF NOT EXISTS idx_items_group ON public.items(group_key);
CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(status_key);
CREATE INDEX IF NOT EXISTS idx_items_board_group_status ON public.items(board_id, group_key, status_key);
CREATE INDEX IF NOT EXISTS idx_items_metadata_gin ON public.items USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_item_activities_item ON public.item_activities(item_id);
CREATE INDEX IF NOT EXISTS idx_item_activities_board ON public.item_activities(board_id);

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_item_status_groups_updated_at') THEN
    CREATE TRIGGER update_item_status_groups_updated_at
      BEFORE UPDATE ON public.item_status_groups
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_item_statuses_updated_at') THEN
    CREATE TRIGGER update_item_statuses_updated_at
      BEFORE UPDATE ON public.item_statuses
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_items_updated_at') THEN
    CREATE TRIGGER update_items_updated_at
      BEFORE UPDATE ON public.items
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_item_activities_updated_at') THEN
    CREATE TRIGGER update_item_activities_updated_at
      BEFORE UPDATE ON public.item_activities
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

INSERT INTO public.item_status_groups (board_id, group_key, display_name, display_order)
SELECT
  b.id,
  g.group_key,
  g.display_name,
  g.display_order
FROM public.boards b
CROSS JOIN (
  VALUES
    ('feedback', 'Feedback', 0),
    ('roadmap', 'Roadmap', 1),
    ('changelog', 'Changelog', 2)
) AS g(group_key, display_name, display_order)
ON CONFLICT (board_id, group_key) DO NOTHING;

INSERT INTO public.item_statuses (board_id, group_key, status_key, label, display_order, is_active)
SELECT
  b.id,
  s.group_key,
  s.status_key,
  s.label,
  s.display_order,
  TRUE
FROM public.boards b
CROSS JOIN (
  VALUES
    ('feedback', 'open', 'Open', 0),
    ('feedback', 'under_review', 'Under review', 1),
    ('feedback', 'planned', 'Planned', 2),
    ('feedback', 'in_progress', 'In progress', 3),
    ('feedback', 'completed', 'Completed', 4),
    ('feedback', 'closed', 'Closed', 5),
    ('roadmap', 'planned', 'Planned', 0),
    ('roadmap', 'in_progress', 'In progress', 1),
    ('roadmap', 'shipped', 'Shipped', 2),
    ('changelog', 'published', 'Published', 0)
) AS s(group_key, status_key, label, display_order)
ON CONFLICT (board_id, group_key, status_key) DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.feedback') IS NOT NULL THEN
    INSERT INTO public.item_statuses (board_id, group_key, status_key, label, display_order, is_active)
    SELECT DISTINCT
      f.board_id,
      'feedback',
      f.status,
      INITCAP(REPLACE(f.status, '_', ' ')),
      100,
      TRUE
    FROM public.feedback f
    WHERE f.status IS NOT NULL AND f.status <> ''
    ON CONFLICT (board_id, group_key, status_key) DO NOTHING;
  END IF;

  IF to_regclass('public.roadmap_items') IS NOT NULL THEN
    INSERT INTO public.item_statuses (board_id, group_key, status_key, label, display_order, is_active)
    SELECT DISTINCT
      r.board_id,
      'roadmap',
      r.status,
      INITCAP(REPLACE(r.status, '_', ' ')),
      100,
      TRUE
    FROM public.roadmap_items r
    WHERE r.status IS NOT NULL AND r.status <> ''
    ON CONFLICT (board_id, group_key, status_key) DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE
  has_fr_is_official BOOLEAN := FALSE;
  has_fr_author_role BOOLEAN := FALSE;
  has_fr_is_internal_note BOOLEAN := FALSE;
  has_ru_update_type BOOLEAN := FALSE;
  has_ru_author_id BOOLEAN := FALSE;
BEGIN
  IF to_regclass('public.feedback') IS NOT NULL THEN
    INSERT INTO public.items (
      id,
      board_id,
      created_at,
      updated_at,
      group_key,
      status_key,
      title,
      description,
      metadata,
      tags,
      visibility,
      vote_count,
      submitter_id,
      submitter_email,
      assigned_to
    )
    SELECT
      f.id,
      f.board_id,
      f.created_at,
      f.updated_at,
      'feedback',
      f.status,
      f.title,
      f.description,
      jsonb_strip_nulls(
        jsonb_build_object(
          'type', f.type,
          'priority', f.priority,
          'steps_to_reproduce', f.steps_to_reproduce,
          'expected_behavior', f.expected_behavior,
          'actual_behavior', f.actual_behavior,
          'environment', f.environment,
          'attachments', f.attachments
        )
      ),
      f.tags,
      CASE
        WHEN f.visibility = 'private' THEN 'private'
        ELSE 'public'
      END,
      COALESCE(f.vote_count, 0),
      f.submitter_id,
      f.submitter_email,
      f.assigned_to
    FROM public.feedback f
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.roadmap_items') IS NOT NULL THEN
    INSERT INTO public.items (
      id,
      board_id,
      created_at,
      updated_at,
      group_key,
      status_key,
      title,
      description,
      metadata,
      tags,
      visibility
    )
    SELECT
      r.id,
      r.board_id,
      r.created_at,
      r.updated_at,
      'roadmap',
      r.status,
      r.title,
      r.description,
      jsonb_strip_nulls(
        jsonb_build_object(
          'target_date', r.target_date,
          'target_quarter', r.target_quarter,
          'display_order', r.display_order
        )
      ),
      r.tags,
      CASE
        WHEN r.visibility = 'internal' THEN 'internal'
        ELSE 'public'
      END
    FROM public.roadmap_items r
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.changelog_entries') IS NOT NULL THEN
    INSERT INTO public.items (
      id,
      board_id,
      created_at,
      updated_at,
      group_key,
      status_key,
      title,
      description,
      metadata,
      tags,
      visibility
    )
    SELECT
      c.id,
      c.board_id,
      c.created_at,
      c.updated_at,
      'changelog',
      'published',
      c.title,
      c.description,
      jsonb_strip_nulls(
        jsonb_build_object(
          'release_date', c.release_date
        )
      ),
      c.tags,
      CASE
        WHEN c.visibility = 'internal' THEN 'internal'
        ELSE 'public'
      END
    FROM public.changelog_entries c
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.feedback_responses') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'feedback_responses'
        AND column_name = 'is_official'
    ) INTO has_fr_is_official;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'feedback_responses'
        AND column_name = 'author_role'
    ) INTO has_fr_author_role;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'feedback_responses'
        AND column_name = 'is_internal_note'
    ) INTO has_fr_is_internal_note;

    EXECUTE format(
      $sql$
        INSERT INTO public.item_activities (
          board_id,
          item_id,
          created_at,
          updated_at,
          activity_type,
          content,
          metadata,
          author_id,
          author_role,
          is_internal_note
        )
        SELECT
          fr.board_id,
          fr.feedback_id,
          fr.created_at,
          fr.updated_at,
          'comment',
          fr.content,
          %s,
          fr.author_id,
          %s,
          %s
        FROM public.feedback_responses fr
        WHERE EXISTS (
          SELECT 1 FROM public.items i WHERE i.id = fr.feedback_id
        )
      $sql$,
      CASE
        WHEN has_fr_is_official
          THEN 'jsonb_strip_nulls(jsonb_build_object(''is_official'', fr.is_official))'
        ELSE '''{}''::jsonb'
      END,
      CASE
        WHEN has_fr_author_role
          THEN 'CASE WHEN fr.author_role = ''admin'' THEN ''admin'' ELSE ''user'' END'
        ELSE '''user'''
      END,
      CASE
        WHEN has_fr_is_internal_note
          THEN 'COALESCE(fr.is_internal_note, FALSE)'
        ELSE 'FALSE'
      END
    );
  END IF;

  IF to_regclass('public.roadmap_updates') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'roadmap_updates'
        AND column_name = 'update_type'
    ) INTO has_ru_update_type;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'roadmap_updates'
        AND column_name = 'author_id'
    ) INTO has_ru_author_id;

    EXECUTE format(
      $sql$
        INSERT INTO public.item_activities (
          board_id,
          item_id,
          created_at,
          updated_at,
          activity_type,
          content,
          metadata,
          author_id,
          author_role,
          is_internal_note
        )
        SELECT
          ru.board_id,
          ru.roadmap_item_id,
          ru.created_at,
          ru.updated_at,
          'update',
          ru.content,
          %s,
          %s,
          'admin',
          FALSE
        FROM public.roadmap_updates ru
        WHERE EXISTS (
          SELECT 1 FROM public.items i WHERE i.id = ru.roadmap_item_id
        )
      $sql$,
      CASE
        WHEN has_ru_update_type
          THEN 'jsonb_strip_nulls(jsonb_build_object(''update_type'', ru.update_type))'
        ELSE '''{}''::jsonb'
      END,
      CASE
        WHEN has_ru_author_id
          THEN 'ru.author_id'
        ELSE 'NULL::uuid'
      END
    );
  END IF;

  DROP TABLE IF EXISTS public.feedback_responses CASCADE;
  DROP TABLE IF EXISTS public.roadmap_updates CASCADE;
  DROP TABLE IF EXISTS public.feedback CASCADE;
  DROP TABLE IF EXISTS public.roadmap_items CASCADE;
  DROP TABLE IF EXISTS public.changelog_entries CASCADE;
END $$;
