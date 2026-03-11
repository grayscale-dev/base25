BEGIN;

-- Remove legacy viewer role semantics and assigned_via attribution.
UPDATE public.workspace_roles
SET role = 'contributor'
WHERE role = 'viewer';

ALTER TABLE public.workspace_roles
  ALTER COLUMN role SET DEFAULT 'contributor';

ALTER TABLE public.workspace_roles
  DROP CONSTRAINT IF EXISTS workspace_roles_role_check;

ALTER TABLE public.workspace_roles
  ADD CONSTRAINT workspace_roles_role_check
  CHECK (role IN ('contributor', 'admin', 'owner'));

ALTER TABLE public.workspace_roles
  DROP COLUMN IF EXISTS assigned_via;

UPDATE public.workspace_access_rules
SET default_role = 'contributor'
WHERE default_role = 'viewer';

ALTER TABLE public.workspace_access_rules
  ALTER COLUMN default_role SET DEFAULT 'contributor';

ALTER TABLE public.workspace_access_rules
  DROP CONSTRAINT IF EXISTS workspace_access_rules_default_role_check;

ALTER TABLE public.workspace_access_rules
  ADD CONSTRAINT workspace_access_rules_default_role_check
  CHECK (default_role IN ('contributor'));

-- Multi-owner model: remove single-owner uniqueness.
DROP INDEX IF EXISTS public.uq_workspace_single_owner;

-- Preserve RPC compatibility while adopting multi-owner semantics.
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
BEGIN
  UPDATE public.workspace_roles
  SET role = 'owner'
  WHERE workspace_id = target_workspace_id
    AND user_id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TARGET_MEMBER_NOT_FOUND';
  END IF;
END;
$$;

-- Owner-only sensitive workspace identity operations include slug/name/status.
CREATE OR REPLACE FUNCTION public.enforce_workspace_owner_sensitive_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (
    NEW.name IS DISTINCT FROM OLD.name
    OR NEW.slug IS DISTINCT FROM OLD.slug
    OR NEW.status IS DISTINCT FROM OLD.status
  )
  AND NOT public.has_workspace_role(OLD.id, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Only a workspace owner can change name, slug, or delete workspace' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Permanent access code now stores encrypted reversible payload for reveal flows.
ALTER TABLE public.workspace_access_codes
  ADD COLUMN IF NOT EXISTS code_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS code_nonce TEXT;

-- Role hierarchy cleanup in policies.
DROP POLICY IF EXISTS items_select_readable ON public.items;
CREATE POLICY items_select_readable ON public.items
  FOR SELECT USING (
    public.can_read_workspace(workspace_id)
    AND (
      visibility = 'public'
      OR public.has_workspace_role(workspace_id, ARRAY['contributor', 'admin', 'owner'])
    )
  );

DROP POLICY IF EXISTS items_insert_contributor ON public.items;
CREATE POLICY items_insert_contributor ON public.items
  FOR INSERT WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['admin', 'owner'])
    OR (
      public.has_workspace_role(workspace_id, ARRAY['contributor'])
      AND group_key = 'feedback'
    )
  );

DROP POLICY IF EXISTS items_update_contributor ON public.items;
CREATE POLICY items_update_contributor ON public.items
  FOR UPDATE USING (
    public.has_workspace_role(workspace_id, ARRAY['admin', 'owner'])
    OR (
      public.has_workspace_role(workspace_id, ARRAY['contributor'])
      AND group_key = 'feedback'
      AND submitter_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['admin', 'owner'])
    OR (
      public.has_workspace_role(workspace_id, ARRAY['contributor'])
      AND group_key = 'feedback'
      AND submitter_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS items_delete_admin ON public.items;
CREATE POLICY items_delete_admin ON public.items
  FOR DELETE USING (
    public.has_workspace_role(workspace_id, ARRAY['admin', 'owner'])
    OR (
      public.has_workspace_role(workspace_id, ARRAY['contributor'])
      AND group_key = 'feedback'
      AND submitter_id = auth.uid()
    )
  );

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
    public.has_workspace_role(workspace_id, ARRAY['admin', 'owner'])
    OR (
      public.has_workspace_role(workspace_id, ARRAY['contributor'])
      AND activity_type IN ('comment', 'update')
      AND author_id = auth.uid()
      AND is_internal_note = false
    )
  );

DROP POLICY IF EXISTS item_activities_update_admin ON public.item_activities;
CREATE POLICY item_activities_update_admin ON public.item_activities
  FOR UPDATE USING (
    public.has_workspace_role(workspace_id, ARRAY['admin', 'owner'])
    OR (
      public.has_workspace_role(workspace_id, ARRAY['contributor'])
      AND activity_type = 'comment'
      AND author_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['admin', 'owner'])
    OR (
      public.has_workspace_role(workspace_id, ARRAY['contributor'])
      AND activity_type = 'comment'
      AND author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS item_activities_delete_admin ON public.item_activities;
CREATE POLICY item_activities_delete_admin ON public.item_activities
  FOR DELETE USING (
    public.has_workspace_role(workspace_id, ARRAY['admin', 'owner'])
    OR (
      public.has_workspace_role(workspace_id, ARRAY['contributor'])
      AND activity_type = 'comment'
      AND author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS billing_customers_admin_only ON public.billing_customers;
CREATE POLICY billing_customers_admin_only ON public.billing_customers
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner']));

DROP POLICY IF EXISTS billing_services_admin_only ON public.billing_services;
CREATE POLICY billing_services_admin_only ON public.billing_services
  FOR ALL USING (public.has_workspace_role(workspace_id, ARRAY['owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner']));

DROP POLICY IF EXISTS api_tokens_admin_only ON public.api_tokens;
CREATE POLICY api_tokens_read_write_staff ON public.api_tokens
  FOR SELECT USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

CREATE POLICY api_tokens_insert_staff ON public.api_tokens
  FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

CREATE POLICY api_tokens_update_staff ON public.api_tokens
  FOR UPDATE USING (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin', 'owner']));

CREATE POLICY api_tokens_delete_owner_only ON public.api_tokens
  FOR DELETE USING (public.has_workspace_role(workspace_id, ARRAY['owner']));

-- Contributor restrictions for direct table writes (SDK entity operations).
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
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.submitter_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Contributors can only edit their own feedback items' USING ERRCODE = '42501';
    END IF;
    IF OLD.group_key <> 'feedback' OR NEW.group_key <> 'feedback' THEN
      RAISE EXCEPTION 'Contributors cannot move non-feedback items' USING ERRCODE = '42501';
    END IF;
    IF NEW.status_key IS DISTINCT FROM OLD.status_key THEN
      RAISE EXCEPTION 'Contributors cannot change item status' USING ERRCODE = '42501';
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

DROP TRIGGER IF EXISTS enforce_contributor_item_mutations_trigger ON public.items;
CREATE TRIGGER enforce_contributor_item_mutations_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_contributor_item_mutations();

COMMIT;
