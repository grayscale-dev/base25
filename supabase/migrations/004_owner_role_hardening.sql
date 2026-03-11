BEGIN;

ALTER TABLE public.workspace_roles
  DROP CONSTRAINT IF EXISTS workspace_roles_role_check;

ALTER TABLE public.workspace_roles
  ADD CONSTRAINT workspace_roles_role_check
  CHECK (role IN ('viewer', 'contributor', 'admin', 'owner'));

-- Ensure only one owner per workspace.
WITH ranked_owners AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id
      ORDER BY created_at ASC, id ASC
    ) AS owner_rank
  FROM public.workspace_roles
  WHERE role = 'owner'
)
UPDATE public.workspace_roles wr
SET role = 'admin'
FROM ranked_owners ro
WHERE wr.id = ro.id
  AND ro.owner_rank > 1;

-- Backfill owner role for legacy workspaces using earliest admin membership.
WITH missing_owner_workspaces AS (
  SELECT w.id AS workspace_id
  FROM public.workspaces w
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.workspace_roles wr
    WHERE wr.workspace_id = w.id
      AND wr.role = 'owner'
  )
),
first_admin_per_workspace AS (
  SELECT DISTINCT ON (wr.workspace_id)
    wr.id,
    wr.workspace_id
  FROM public.workspace_roles wr
  JOIN missing_owner_workspaces mw
    ON mw.workspace_id = wr.workspace_id
  WHERE wr.role = 'admin'
  ORDER BY wr.workspace_id, wr.created_at ASC, wr.id ASC
)
UPDATE public.workspace_roles wr
SET role = 'owner'
FROM first_admin_per_workspace fa
WHERE wr.id = fa.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_single_owner
  ON public.workspace_roles(workspace_id)
  WHERE role = 'owner';

CREATE OR REPLACE FUNCTION public.transfer_workspace_owner(
  target_workspace_id UUID,
  target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  target_membership_id UUID;
  current_owner_membership_id UUID;
BEGIN
  SELECT wr.id
  INTO target_membership_id
  FROM public.workspace_roles wr
  WHERE wr.workspace_id = target_workspace_id
    AND wr.user_id = target_user_id
  LIMIT 1;

  IF target_membership_id IS NULL THEN
    RAISE EXCEPTION 'TARGET_MEMBER_NOT_FOUND';
  END IF;

  SELECT wr.id
  INTO current_owner_membership_id
  FROM public.workspace_roles wr
  WHERE wr.workspace_id = target_workspace_id
    AND wr.role = 'owner'
  LIMIT 1;

  IF current_owner_membership_id = target_membership_id THEN
    RETURN;
  END IF;

  IF current_owner_membership_id IS NOT NULL THEN
    UPDATE public.workspace_roles
    SET role = 'admin'
    WHERE id = current_owner_membership_id;
  END IF;

  UPDATE public.workspace_roles
  SET role = 'owner'
  WHERE id = target_membership_id;
END;
$$;

-- Enforce owner-only updates for sensitive workspace fields when writes are not service-role.
CREATE OR REPLACE FUNCTION public.enforce_workspace_owner_sensitive_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (NEW.name IS DISTINCT FROM OLD.name OR NEW.status IS DISTINCT FROM OLD.status)
     AND NOT public.has_workspace_role(OLD.id, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Only the workspace owner can change name or delete workspace' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_workspace_owner_sensitive_updates_trigger ON public.workspaces;
CREATE TRIGGER enforce_workspace_owner_sensitive_updates_trigger
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_workspace_owner_sensitive_updates();

-- Prevent direct client-side owner mutation/removal; owner transitions are handled by service-role functions.
CREATE OR REPLACE FUNCTION public.enforce_workspace_owner_membership_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' THEN
      RAISE EXCEPTION 'Owner membership cannot be removed directly' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.role = 'owner' AND NEW.role <> 'owner' THEN
    RAISE EXCEPTION 'Owner role cannot be changed directly' USING ERRCODE = '42501';
  END IF;

  IF OLD.role <> 'owner' AND NEW.role = 'owner' THEN
    RAISE EXCEPTION 'Transfer ownership through controlled function' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_workspace_owner_membership_integrity_trigger ON public.workspace_roles;
CREATE TRIGGER enforce_workspace_owner_membership_integrity_trigger
  BEFORE UPDATE OR DELETE ON public.workspace_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_workspace_owner_membership_integrity();

DROP POLICY IF EXISTS workspaces_update_admin ON public.workspaces;
CREATE POLICY workspaces_update_admin ON public.workspaces
  FOR UPDATE USING (public.has_workspace_role(id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS workspaces_delete_admin ON public.workspaces;
CREATE POLICY workspaces_delete_admin ON public.workspaces
  FOR DELETE USING (public.has_workspace_role(id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS workspace_roles_select_members ON public.workspace_roles;
CREATE POLICY workspace_roles_select_members ON public.workspace_roles
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR public.has_workspace_role(workspace_id, ARRAY['admin', 'owner'])
    )
  );

DROP POLICY IF EXISTS workspace_roles_write_admin ON public.workspace_roles;
CREATE POLICY workspace_roles_write_admin ON public.workspace_roles
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS workspace_access_rules_admin_only ON public.workspace_access_rules;
CREATE POLICY workspace_access_rules_admin_only ON public.workspace_access_rules
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS item_status_groups_admin_only ON public.item_status_groups;
CREATE POLICY item_status_groups_admin_only ON public.item_status_groups
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS item_statuses_admin_only ON public.item_statuses;
CREATE POLICY item_statuses_admin_only ON public.item_statuses
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS items_select_readable ON public.items;
CREATE POLICY items_select_readable ON public.items
  FOR SELECT USING (
    public.can_read_workspace(workspace_id)
    AND (
      visibility = 'public'
      OR public.has_workspace_role(workspace_id, ARRAY['viewer', 'contributor', 'admin', 'owner'])
    )
  );

DROP POLICY IF EXISTS items_insert_contributor ON public.items;
CREATE POLICY items_insert_contributor ON public.items
  FOR INSERT WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
  );

DROP POLICY IF EXISTS items_update_contributor ON public.items;
CREATE POLICY items_update_contributor ON public.items
  FOR UPDATE USING (public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner']));

DROP POLICY IF EXISTS items_delete_admin ON public.items;
CREATE POLICY items_delete_admin ON public.items
  FOR DELETE USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS item_activities_select_readable ON public.item_activities;
CREATE POLICY item_activities_select_readable ON public.item_activities
  FOR SELECT USING (
    public.can_read_workspace(workspace_id)
    AND (
      is_internal_note = false
      OR public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
    )
  );

DROP POLICY IF EXISTS item_activities_insert_contributor ON public.item_activities;
CREATE POLICY item_activities_insert_contributor ON public.item_activities
  FOR INSERT WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
  );

DROP POLICY IF EXISTS item_activities_update_admin ON public.item_activities;
CREATE POLICY item_activities_update_admin ON public.item_activities
  FOR UPDATE USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS item_activities_delete_admin ON public.item_activities;
CREATE POLICY item_activities_delete_admin ON public.item_activities
  FOR DELETE USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS api_tokens_admin_only ON public.api_tokens;
CREATE POLICY api_tokens_admin_only ON public.api_tokens
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS audit_logs_admin_only ON public.audit_logs;
CREATE POLICY audit_logs_admin_only ON public.audit_logs
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS billing_customers_admin_only ON public.billing_customers;
CREATE POLICY billing_customers_admin_only ON public.billing_customers
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

DROP POLICY IF EXISTS billing_services_admin_only ON public.billing_services;
CREATE POLICY billing_services_admin_only ON public.billing_services
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

COMMIT;
