-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Tenants
CREATE POLICY tenants_insert_authenticated ON tenants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY tenants_select_members ON tenants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = tenants.id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY tenants_update_admins ON tenants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = tenants.id AND tm.user_id = auth.uid() AND tm.is_tenant_admin
    )
  );

CREATE POLICY tenants_delete_admins ON tenants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = tenants.id AND tm.user_id = auth.uid() AND tm.is_tenant_admin
    )
  );

-- Tenant members
CREATE POLICY tenant_members_select_self_or_admin ON tenant_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tenant_members admin
      WHERE admin.tenant_id = tenant_members.tenant_id
        AND admin.user_id = auth.uid()
        AND admin.is_tenant_admin
    )
  );

CREATE POLICY tenant_members_insert_self_or_bootstrap ON tenant_members
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
    AND (
      NOT EXISTS (
        SELECT 1 FROM tenant_members existing
        WHERE existing.tenant_id = tenant_members.tenant_id
      )
      OR EXISTS (
        SELECT 1 FROM tenant_members admin
        WHERE admin.tenant_id = tenant_members.tenant_id
          AND admin.user_id = auth.uid()
          AND admin.is_tenant_admin
      )
    )
  );

CREATE POLICY tenant_members_update_self_or_admin ON tenant_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tenant_members admin
      WHERE admin.tenant_id = tenant_members.tenant_id
        AND admin.user_id = auth.uid()
        AND admin.is_tenant_admin
    )
  );

CREATE POLICY tenant_members_delete_admin ON tenant_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tenant_members admin
      WHERE admin.tenant_id = tenant_members.tenant_id
        AND admin.user_id = auth.uid()
        AND admin.is_tenant_admin
    )
  );

-- Workspaces
CREATE POLICY workspaces_select_public_or_member ON workspaces
  FOR SELECT USING (
    (visibility = 'public' AND status = 'active')
    OR (
      auth.role() = 'authenticated'
      AND (
        EXISTS (
          SELECT 1 FROM workspace_roles wr
          WHERE wr.workspace_id = workspaces.id AND wr.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM tenant_members tm
          WHERE tm.tenant_id = workspaces.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.is_tenant_admin
        )
      )
    )
  );

CREATE POLICY workspaces_insert_tenant_admins ON workspaces
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = workspaces.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY workspaces_update_admins ON workspaces
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = workspaces.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = workspaces.id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
  );

CREATE POLICY workspaces_delete_admins ON workspaces
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = workspaces.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = workspaces.id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
  );

-- Workspace roles
CREATE POLICY workspace_roles_select_self_or_admin ON workspace_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_roles admin
      WHERE admin.workspace_id = workspace_roles.workspace_id
        AND admin.user_id = auth.uid()
        AND admin.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = workspace_roles.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY workspace_roles_insert_admins ON workspace_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_roles admin
      WHERE admin.workspace_id = workspace_roles.workspace_id
        AND admin.user_id = auth.uid()
        AND admin.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = workspace_roles.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY workspace_roles_update_admins ON workspace_roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_roles admin
      WHERE admin.workspace_id = workspace_roles.workspace_id
        AND admin.user_id = auth.uid()
        AND admin.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = workspace_roles.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY workspace_roles_delete_admins ON workspace_roles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_roles admin
      WHERE admin.workspace_id = workspace_roles.workspace_id
        AND admin.user_id = auth.uid()
        AND admin.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = workspace_roles.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Access rules (admins only)
CREATE POLICY access_rules_admin_select ON access_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = access_rules.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = access_rules.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY access_rules_admin_write ON access_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = access_rules.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = access_rules.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = access_rules.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = access_rules.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Feedback
CREATE POLICY feedback_select_public_or_member ON feedback
  FOR SELECT USING (
    (
      visibility = 'public'
      AND EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = feedback.workspace_id
          AND w.visibility = 'public'
          AND w.status = 'active'
      )
    )
    OR (
      auth.role() = 'authenticated'
      AND (
        submitter_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workspace_roles wr
          WHERE wr.workspace_id = feedback.workspace_id
            AND wr.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM tenant_members tm
          WHERE tm.tenant_id = (
            SELECT w.tenant_id FROM workspaces w WHERE w.id = feedback.workspace_id
          )
            AND tm.user_id = auth.uid()
            AND tm.is_tenant_admin
        )
      )
    )
  );

CREATE POLICY feedback_insert_authenticated ON feedback
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM workspace_roles wr
        WHERE wr.workspace_id = feedback.workspace_id
          AND wr.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM tenant_members tm
        WHERE tm.tenant_id = (
          SELECT w.tenant_id FROM workspaces w WHERE w.id = feedback.workspace_id
        )
          AND tm.user_id = auth.uid()
          AND tm.is_tenant_admin
      )
      OR EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = feedback.workspace_id
          AND w.visibility = 'public'
          AND w.status = 'active'
      )
    )
  );

CREATE POLICY feedback_update_staff ON feedback
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = feedback.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = feedback.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY feedback_delete_admin ON feedback
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = feedback.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = feedback.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Feedback responses
CREATE POLICY feedback_responses_select_public_or_member ON feedback_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feedback f
      WHERE f.id = feedback_responses.feedback_id
        AND (
          f.visibility = 'public'
          AND EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = f.workspace_id
              AND w.visibility = 'public'
              AND w.status = 'active'
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = feedback_responses.workspace_id
        AND wr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = feedback_responses.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY feedback_responses_insert_staff_or_submitter ON feedback_responses
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM workspace_roles wr
        WHERE wr.workspace_id = feedback_responses.workspace_id
          AND wr.user_id = auth.uid()
          AND wr.role IN ('support', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM feedback f
        WHERE f.id = feedback_responses.feedback_id
          AND f.submitter_id = auth.uid()
      )
    )
  );

CREATE POLICY feedback_responses_update_staff ON feedback_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = feedback_responses.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = feedback_responses.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY feedback_responses_delete_admin ON feedback_responses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = feedback_responses.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = feedback_responses.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Roadmap items
CREATE POLICY roadmap_items_select_public_or_member ON roadmap_items
  FOR SELECT USING (
    (
      visibility = 'public'
      AND EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = roadmap_items.workspace_id
          AND w.visibility = 'public'
          AND w.status = 'active'
      )
    )
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = roadmap_items.workspace_id
        AND wr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = roadmap_items.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY roadmap_items_write_staff ON roadmap_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = roadmap_items.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = roadmap_items.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = roadmap_items.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = roadmap_items.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Roadmap updates
CREATE POLICY roadmap_updates_select_public_or_member ON roadmap_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM roadmap_items ri
      WHERE ri.id = roadmap_updates.roadmap_item_id
        AND (
          ri.visibility = 'public'
          AND EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = ri.workspace_id
              AND w.visibility = 'public'
              AND w.status = 'active'
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = roadmap_updates.workspace_id
        AND wr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = roadmap_updates.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY roadmap_updates_write_staff ON roadmap_updates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = roadmap_updates.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = roadmap_updates.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = roadmap_updates.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = roadmap_updates.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Support threads
CREATE POLICY support_threads_select_participants ON support_threads
  FOR SELECT USING (
    requester_id = auth.uid()
    OR assigned_to = auth.uid()
    OR auth.uid() = ANY (participants)
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = support_threads.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = support_threads.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY support_threads_insert_authenticated ON support_threads
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND requester_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM workspace_roles wr
        WHERE wr.workspace_id = support_threads.workspace_id
          AND wr.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM tenant_members tm
        WHERE tm.tenant_id = (
          SELECT w.tenant_id FROM workspaces w WHERE w.id = support_threads.workspace_id
        )
          AND tm.user_id = auth.uid()
          AND tm.is_tenant_admin
      )
      OR EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = support_threads.workspace_id
          AND w.visibility = 'public'
          AND w.status = 'active'
      )
    )
  );

CREATE POLICY support_threads_update_staff ON support_threads
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = support_threads.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = support_threads.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY support_threads_delete_admin ON support_threads
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = support_threads.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = support_threads.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Support messages
CREATE POLICY support_messages_select_participants ON support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM support_threads st
      WHERE st.id = support_messages.thread_id
        AND (
          st.requester_id = auth.uid()
          OR st.assigned_to = auth.uid()
          OR auth.uid() = ANY (st.participants)
        )
    )
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = support_messages.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = support_messages.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY support_messages_insert_authorized ON support_messages
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM support_threads st
        WHERE st.id = support_messages.thread_id
          AND (
            st.requester_id = auth.uid()
            OR st.assigned_to = auth.uid()
            OR auth.uid() = ANY (st.participants)
          )
      )
      OR EXISTS (
        SELECT 1 FROM workspace_roles wr
        WHERE wr.workspace_id = support_messages.workspace_id
          AND wr.user_id = auth.uid()
          AND wr.role IN ('support', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM tenant_members tm
        WHERE tm.tenant_id = (
          SELECT w.tenant_id FROM workspaces w WHERE w.id = support_messages.workspace_id
        )
          AND tm.user_id = auth.uid()
          AND tm.is_tenant_admin
      )
    )
    AND (
      is_internal_note = FALSE
      OR EXISTS (
        SELECT 1 FROM workspace_roles wr
        WHERE wr.workspace_id = support_messages.workspace_id
          AND wr.user_id = auth.uid()
          AND wr.role IN ('support', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM tenant_members tm
        WHERE tm.tenant_id = (
          SELECT w.tenant_id FROM workspaces w WHERE w.id = support_messages.workspace_id
        )
          AND tm.user_id = auth.uid()
          AND tm.is_tenant_admin
      )
    )
  );

CREATE POLICY support_messages_update_staff_or_author ON support_messages
  FOR UPDATE USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = support_messages.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = support_messages.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY support_messages_delete_admin ON support_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = support_messages.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = support_messages.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- API tokens
CREATE POLICY api_tokens_admin_only ON api_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = api_tokens.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = api_tokens.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = api_tokens.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = api_tokens.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Audit logs
CREATE POLICY audit_logs_admin_only ON audit_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = audit_logs.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = audit_logs.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = audit_logs.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = audit_logs.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Changelog entries
CREATE POLICY changelog_entries_select_public_or_member ON changelog_entries
  FOR SELECT USING (
    (
      visibility = 'public'
      AND EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = changelog_entries.workspace_id
          AND w.visibility = 'public'
          AND w.status = 'active'
      )
    )
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = changelog_entries.workspace_id
        AND wr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = changelog_entries.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY changelog_entries_write_staff ON changelog_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = changelog_entries.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = changelog_entries.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = changelog_entries.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = changelog_entries.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Doc pages
CREATE POLICY doc_pages_select_public_or_member ON doc_pages
  FOR SELECT USING (
    (
      is_published = TRUE
      AND EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = doc_pages.workspace_id
          AND w.visibility = 'public'
          AND w.status = 'active'
      )
    )
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = doc_pages.workspace_id
        AND wr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = doc_pages.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY doc_pages_write_staff ON doc_pages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = doc_pages.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = doc_pages.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = doc_pages.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = doc_pages.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Doc comments
CREATE POLICY doc_comments_select_public_or_member ON doc_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM doc_pages dp
      WHERE dp.id = doc_comments.doc_page_id
        AND dp.is_published = TRUE
        AND EXISTS (
          SELECT 1 FROM workspaces w
          WHERE w.id = dp.workspace_id
            AND w.visibility = 'public'
            AND w.status = 'active'
        )
    )
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = doc_comments.workspace_id
        AND wr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = doc_comments.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY doc_comments_insert_authenticated ON doc_comments
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM doc_pages dp
        WHERE dp.id = doc_comments.doc_page_id
          AND dp.is_published = TRUE
          AND EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = dp.workspace_id
              AND w.visibility = 'public'
              AND w.status = 'active'
          )
      )
      OR EXISTS (
        SELECT 1 FROM workspace_roles wr
        WHERE wr.workspace_id = doc_comments.workspace_id
          AND wr.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM tenant_members tm
        WHERE tm.tenant_id = (
          SELECT w.tenant_id FROM workspaces w WHERE w.id = doc_comments.workspace_id
        )
          AND tm.user_id = auth.uid()
          AND tm.is_tenant_admin
      )
    )
  );

CREATE POLICY doc_comments_update_author_or_staff ON doc_comments
  FOR UPDATE USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = doc_comments.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = doc_comments.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

CREATE POLICY doc_comments_delete_admin ON doc_comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = doc_comments.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = doc_comments.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Doc queue (staff/admin only)
CREATE POLICY doc_queue_staff_only ON doc_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = doc_queue.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = doc_queue.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_roles wr
      WHERE wr.workspace_id = doc_queue.workspace_id
        AND wr.user_id = auth.uid()
        AND wr.role IN ('support', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = (
        SELECT w.tenant_id FROM workspaces w WHERE w.id = doc_queue.workspace_id
      )
        AND tm.user_id = auth.uid()
        AND tm.is_tenant_admin
    )
  );

-- Waitlist signups
CREATE POLICY waitlist_signups_insert_anyone ON waitlist_signups
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY waitlist_signups_select_admin ON waitlist_signups
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.is_tenant_admin
    )
  );

CREATE POLICY waitlist_signups_update_admin ON waitlist_signups
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.is_tenant_admin
    )
  );

CREATE POLICY waitlist_signups_delete_admin ON waitlist_signups
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.is_tenant_admin
    )
  );
