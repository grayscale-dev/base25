-- Enforce authenticated membership for all workspace data reads.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_read_workspace(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.workspace_roles wr
      WHERE wr.workspace_id = target_workspace_id
        AND wr.user_id = auth.uid()
    );
$$;

DROP POLICY IF EXISTS workspace_roles_select_members ON public.workspace_roles;

CREATE POLICY workspace_roles_select_members ON public.workspace_roles
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR public.has_workspace_role(workspace_id, ARRAY['admin'])
    )
  );

COMMIT;
