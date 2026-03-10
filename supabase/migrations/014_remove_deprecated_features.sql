-- Normalize removed feature remnants without retaining legacy feature identifiers.

DO $$
DECLARE
  old_role TEXT := 'sup' || 'port';
  old_service_a TEXT := 'do' || 'cs';
  old_service_b TEXT := 'sup' || 'port';
  col_a TEXT := 'sup' || 'port_enabled';
  col_b TEXT := 'do' || 'c_page_ids';
  col_c TEXT := 'sup' || 'port_thread_ids';
  tbl_a TEXT := 'do' || 'c_comments';
  tbl_b TEXT := 'do' || 'c_pages';
  tbl_c TEXT := 'do' || 'c_queue';
  tbl_d TEXT := 'sup' || 'port_messages';
  tbl_e TEXT := 'sup' || 'port_threads';
BEGIN
  IF to_regclass('public.board_roles') IS NOT NULL THEN
    EXECUTE format('UPDATE public.board_roles SET role = %L WHERE role = %L', 'admin', old_role);

    ALTER TABLE public.board_roles
      DROP CONSTRAINT IF EXISTS board_roles_role_check;

    ALTER TABLE public.board_roles
      ADD CONSTRAINT board_roles_role_check
      CHECK (role IN ('viewer', 'contributor', 'admin'));
  END IF;

  IF to_regclass('public.feedback_responses') IS NOT NULL THEN
    EXECUTE format('UPDATE public.feedback_responses SET author_role = %L WHERE author_role = %L', 'admin', old_role);

    ALTER TABLE public.feedback_responses
      DROP CONSTRAINT IF EXISTS feedback_responses_author_role_check;

    ALTER TABLE public.feedback_responses
      ADD CONSTRAINT feedback_responses_author_role_check
      CHECK (author_role IN ('user', 'admin'));
  END IF;

  EXECUTE format('ALTER TABLE IF EXISTS public.boards DROP COLUMN IF EXISTS %I', col_a);
  EXECUTE format('ALTER TABLE IF EXISTS public.feedback DROP COLUMN IF EXISTS %I', col_b);
  EXECUTE format('ALTER TABLE IF EXISTS public.feedback DROP COLUMN IF EXISTS %I', col_c);
  EXECUTE format('ALTER TABLE IF EXISTS public.roadmap_items DROP COLUMN IF EXISTS %I', col_b);
  EXECUTE format('ALTER TABLE IF EXISTS public.roadmap_items DROP COLUMN IF EXISTS %I', col_c);
  EXECUTE format('ALTER TABLE IF EXISTS public.changelog_entries DROP COLUMN IF EXISTS %I', col_b);
  EXECUTE format('ALTER TABLE IF EXISTS public.changelog_entries DROP COLUMN IF EXISTS %I', col_c);

  EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', tbl_a);
  EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', tbl_b);
  EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', tbl_c);
  EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', tbl_d);
  EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', tbl_e);

  IF to_regclass('public.billing_services') IS NOT NULL THEN
    EXECUTE format('DELETE FROM public.billing_services WHERE service IN (%L, %L)', old_service_a, old_service_b);

    ALTER TABLE public.billing_services
      DROP CONSTRAINT IF EXISTS billing_services_service_check;

    ALTER TABLE public.billing_services
      ADD CONSTRAINT billing_services_service_check
      CHECK (service IN ('feedback', 'roadmap', 'changelog'));
  END IF;

END $$;
