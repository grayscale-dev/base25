-- Optional transition script for environments that still have legacy split tables.
-- Safe to run on fresh installs where legacy tables do not exist.

DO $$
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
      jsonb_strip_nulls(
        jsonb_build_object(
          'is_official', fr.is_official
        )
      ),
      fr.author_id,
      fr.author_role,
      fr.is_internal_note
    FROM public.feedback_responses fr
    WHERE EXISTS (
      SELECT 1 FROM public.items i WHERE i.id = fr.feedback_id
    );
  END IF;

  IF to_regclass('public.roadmap_updates') IS NOT NULL THEN
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
      jsonb_strip_nulls(
        jsonb_build_object(
          'update_type', ru.update_type
        )
      ),
      ru.author_id,
      'admin',
      FALSE
    FROM public.roadmap_updates ru
    WHERE EXISTS (
      SELECT 1 FROM public.items i WHERE i.id = ru.roadmap_item_id
    );
  END IF;

  DROP TABLE IF EXISTS public.feedback_responses CASCADE;
  DROP TABLE IF EXISTS public.roadmap_updates CASCADE;
  DROP TABLE IF EXISTS public.feedback CASCADE;
  DROP TABLE IF EXISTS public.roadmap_items CASCADE;
  DROP TABLE IF EXISTS public.changelog_entries CASCADE;
END $$;
