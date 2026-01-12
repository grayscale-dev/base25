-- Enable RLS on renamed tables
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_access_rules ENABLE ROW LEVEL SECURITY;
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

-- Drop legacy policies (pre-board refactor)
DROP POLICY IF EXISTS feedback_select_public_or_member ON feedback;
DROP POLICY IF EXISTS feedback_insert_authenticated ON feedback;
DROP POLICY IF EXISTS feedback_update_staff ON feedback;
DROP POLICY IF EXISTS feedback_delete_admin ON feedback;

DROP POLICY IF EXISTS feedback_responses_select_public_or_member ON feedback_responses;
DROP POLICY IF EXISTS feedback_responses_insert_staff_or_submitter ON feedback_responses;
DROP POLICY IF EXISTS feedback_responses_update_staff ON feedback_responses;
DROP POLICY IF EXISTS feedback_responses_delete_admin ON feedback_responses;

DROP POLICY IF EXISTS roadmap_items_select_public_or_member ON roadmap_items;
DROP POLICY IF EXISTS roadmap_items_write_staff ON roadmap_items;

DROP POLICY IF EXISTS roadmap_updates_select_public_or_member ON roadmap_updates;
DROP POLICY IF EXISTS roadmap_updates_write_staff ON roadmap_updates;

DROP POLICY IF EXISTS support_threads_select_participants ON support_threads;
DROP POLICY IF EXISTS support_threads_insert_authenticated ON support_threads;
DROP POLICY IF EXISTS support_threads_update_staff ON support_threads;
DROP POLICY IF EXISTS support_threads_delete_admin ON support_threads;

DROP POLICY IF EXISTS support_messages_select_participants ON support_messages;
DROP POLICY IF EXISTS support_messages_insert_authorized ON support_messages;
DROP POLICY IF EXISTS support_messages_update_staff_or_author ON support_messages;
DROP POLICY IF EXISTS support_messages_delete_admin ON support_messages;

DROP POLICY IF EXISTS api_tokens_admin_only ON api_tokens;
DROP POLICY IF EXISTS audit_logs_admin_only ON audit_logs;

DROP POLICY IF EXISTS changelog_entries_select_public_or_member ON changelog_entries;
DROP POLICY IF EXISTS changelog_entries_write_staff ON changelog_entries;

DROP POLICY IF EXISTS doc_pages_select_public_or_member ON doc_pages;
DROP POLICY IF EXISTS doc_pages_write_staff ON doc_pages;

DROP POLICY IF EXISTS doc_comments_select_public_or_member ON doc_comments;
DROP POLICY IF EXISTS doc_comments_insert_authenticated ON doc_comments;
DROP POLICY IF EXISTS doc_comments_update_author_or_staff ON doc_comments;
DROP POLICY IF EXISTS doc_comments_delete_admin ON doc_comments;

DROP POLICY IF EXISTS doc_queue_staff_only ON doc_queue;

DROP POLICY IF EXISTS waitlist_signups_insert_anyone ON waitlist_signups;
DROP POLICY IF EXISTS waitlist_signups_select_admin ON waitlist_signups;
DROP POLICY IF EXISTS waitlist_signups_update_admin ON waitlist_signups;
DROP POLICY IF EXISTS waitlist_signups_delete_admin ON waitlist_signups;

DROP POLICY IF EXISTS access_rules_admin_select ON board_access_rules;
DROP POLICY IF EXISTS access_rules_admin_write ON board_access_rules;

-- Helper functions for access checks
CREATE OR REPLACE FUNCTION email_matches_board_rule(board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM board_access_rules bar
    WHERE bar.board_id = email_matches_board_rule.board_id
      AND bar.is_active = true
      AND (
        (
          bar.pattern_type = 'domain'
          AND lower(split_part(auth.jwt() ->> 'email', '@', 2)) =
              lower(regexp_replace(bar.pattern, '^[*@]+', ''))
        )
        OR (
          bar.pattern_type = 'substring'
          AND lower(auth.jwt() ->> 'email') LIKE '%' || lower(bar.pattern) || '%'
        )
        OR (
          bar.pattern_type = 'exact'
          AND lower(auth.jwt() ->> 'email') = lower(bar.pattern)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION has_board_role(board_id uuid, roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM board_roles br
    WHERE br.board_id = has_board_role.board_id
      AND br.user_id = auth.uid()
      AND br.role = ANY (roles)
  );
$$;

CREATE OR REPLACE FUNCTION can_read_board(board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM boards b
    WHERE b.id = can_read_board.board_id
      AND b.visibility = 'public'
      AND b.status = 'active'
  )
  OR (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1
        FROM board_roles br
        WHERE br.board_id = can_read_board.board_id
          AND br.user_id = auth.uid()
      )
      OR email_matches_board_rule(can_read_board.board_id)
    )
  );
$$;

-- Boards
DROP POLICY IF EXISTS workspaces_select_public_or_member ON boards;
DROP POLICY IF EXISTS workspaces_insert_tenant_admins ON boards;
DROP POLICY IF EXISTS workspaces_update_admins ON boards;
DROP POLICY IF EXISTS workspaces_delete_admins ON boards;

CREATE POLICY boards_select_public_or_member ON boards
  FOR SELECT USING (can_read_board(id));

CREATE POLICY boards_insert_authenticated ON boards
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY boards_update_admins ON boards
  FOR UPDATE USING (has_board_role(id, ARRAY['admin']));

CREATE POLICY boards_delete_admins ON boards
  FOR DELETE USING (has_board_role(id, ARRAY['admin']));

-- Board roles
DROP POLICY IF EXISTS workspace_roles_select_self_or_admin ON board_roles;
DROP POLICY IF EXISTS workspace_roles_insert_admins ON board_roles;
DROP POLICY IF EXISTS workspace_roles_update_admins ON board_roles;
DROP POLICY IF EXISTS workspace_roles_delete_admins ON board_roles;

CREATE POLICY board_roles_select_self_or_admin ON board_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR has_board_role(board_id, ARRAY['admin'])
  );

CREATE POLICY board_roles_insert_bootstrap_or_admin ON board_roles
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      has_board_role(board_id, ARRAY['admin'])
      OR NOT EXISTS (
        SELECT 1 FROM board_roles existing WHERE existing.board_id = board_roles.board_id
      )
    )
  );

CREATE POLICY board_roles_insert_via_rule ON board_roles
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND lower(email) = lower(auth.jwt() ->> 'email')
    AND email_matches_board_rule(board_id)
  );

CREATE POLICY board_roles_update_admin ON board_roles
  FOR UPDATE USING (has_board_role(board_id, ARRAY['admin']));

DROP POLICY IF EXISTS board_roles_update_self_claim ON board_roles;
CREATE POLICY board_roles_update_self_claim ON board_roles
  FOR UPDATE USING (
    (user_id IS NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
    OR user_id = auth.uid()
    OR has_board_role(board_id, ARRAY['admin'])
  )
  WITH CHECK (user_id = auth.uid());

CREATE POLICY board_roles_delete_admin ON board_roles
  FOR DELETE USING (has_board_role(board_id, ARRAY['admin']));

-- Board access rules (admin only)
CREATE POLICY board_access_rules_admin ON board_access_rules
  FOR ALL USING (has_board_role(board_id, ARRAY['admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['admin']));

-- Feedback
CREATE POLICY feedback_select_public_or_member ON feedback
  FOR SELECT USING (can_read_board(board_id));

CREATE POLICY feedback_insert_members ON feedback
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM board_roles br
      WHERE br.board_id = feedback.board_id
        AND br.user_id = auth.uid()
    )
  );

CREATE POLICY feedback_update_staff ON feedback
  FOR UPDATE USING (has_board_role(board_id, ARRAY['support', 'admin']));

CREATE POLICY feedback_delete_admin ON feedback
  FOR DELETE USING (has_board_role(board_id, ARRAY['admin']));

-- Feedback responses
CREATE POLICY feedback_responses_select_public_or_member ON feedback_responses
  FOR SELECT USING (can_read_board(board_id));

CREATE POLICY feedback_responses_insert_members ON feedback_responses
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM board_roles br
      WHERE br.board_id = feedback_responses.board_id
        AND br.user_id = auth.uid()
    )
  );

CREATE POLICY feedback_responses_update_staff ON feedback_responses
  FOR UPDATE USING (has_board_role(board_id, ARRAY['support', 'admin']));

CREATE POLICY feedback_responses_delete_admin ON feedback_responses
  FOR DELETE USING (has_board_role(board_id, ARRAY['admin']));

-- Roadmap items
CREATE POLICY roadmap_items_select_public_or_member ON roadmap_items
  FOR SELECT USING (can_read_board(board_id));

CREATE POLICY roadmap_items_write_staff ON roadmap_items
  FOR ALL USING (has_board_role(board_id, ARRAY['support', 'admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['support', 'admin']));

-- Roadmap updates
CREATE POLICY roadmap_updates_select_public_or_member ON roadmap_updates
  FOR SELECT USING (can_read_board(board_id));

CREATE POLICY roadmap_updates_write_staff ON roadmap_updates
  FOR ALL USING (has_board_role(board_id, ARRAY['support', 'admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['support', 'admin']));

-- Support threads
CREATE POLICY support_threads_select_participants ON support_threads
  FOR SELECT USING (
    requester_id = auth.uid()
    OR assigned_to = auth.uid()
    OR auth.uid() = ANY (participants)
    OR has_board_role(board_id, ARRAY['support', 'admin'])
  );

CREATE POLICY support_threads_insert_members ON support_threads
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND requester_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM board_roles br
      WHERE br.board_id = support_threads.board_id
        AND br.user_id = auth.uid()
    )
  );

CREATE POLICY support_threads_update_staff ON support_threads
  FOR UPDATE USING (has_board_role(board_id, ARRAY['support', 'admin']));

CREATE POLICY support_threads_delete_admin ON support_threads
  FOR DELETE USING (has_board_role(board_id, ARRAY['admin']));

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
    OR has_board_role(board_id, ARRAY['support', 'admin'])
  );

CREATE POLICY support_messages_insert_members ON support_messages
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM board_roles br
      WHERE br.board_id = support_messages.board_id
        AND br.user_id = auth.uid()
    )
  );

CREATE POLICY support_messages_update_staff_or_author ON support_messages
  FOR UPDATE USING (
    author_id = auth.uid()
    OR has_board_role(board_id, ARRAY['support', 'admin'])
  );

CREATE POLICY support_messages_delete_admin ON support_messages
  FOR DELETE USING (has_board_role(board_id, ARRAY['admin']));

-- API tokens
CREATE POLICY api_tokens_admin_only ON api_tokens
  FOR ALL USING (has_board_role(board_id, ARRAY['admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['admin']));

-- Audit logs
CREATE POLICY audit_logs_staff_only ON audit_logs
  FOR ALL USING (has_board_role(board_id, ARRAY['support', 'admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['support', 'admin']));

-- Changelog entries
CREATE POLICY changelog_entries_select_public_or_member ON changelog_entries
  FOR SELECT USING (can_read_board(board_id));

CREATE POLICY changelog_entries_write_staff ON changelog_entries
  FOR ALL USING (has_board_role(board_id, ARRAY['support', 'admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['support', 'admin']));

-- Doc pages
CREATE POLICY doc_pages_select_public_or_member ON doc_pages
  FOR SELECT USING (can_read_board(board_id));

CREATE POLICY doc_pages_write_staff ON doc_pages
  FOR ALL USING (has_board_role(board_id, ARRAY['support', 'admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['support', 'admin']));

-- Doc comments
CREATE POLICY doc_comments_select_public_or_member ON doc_comments
  FOR SELECT USING (can_read_board(board_id));

CREATE POLICY doc_comments_insert_members ON doc_comments
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM board_roles br
      WHERE br.board_id = doc_comments.board_id
        AND br.user_id = auth.uid()
    )
  );

CREATE POLICY doc_comments_update_author_or_staff ON doc_comments
  FOR UPDATE USING (
    author_id = auth.uid()
    OR has_board_role(board_id, ARRAY['support', 'admin'])
  );

CREATE POLICY doc_comments_delete_admin ON doc_comments
  FOR DELETE USING (has_board_role(board_id, ARRAY['admin']));

-- Doc queue
CREATE POLICY doc_queue_staff_only ON doc_queue
  FOR ALL USING (has_board_role(board_id, ARRAY['support', 'admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['support', 'admin']));

-- Waitlist signups
CREATE POLICY waitlist_signups_insert_anyone ON waitlist_signups
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY waitlist_signups_select_admin ON waitlist_signups
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY waitlist_signups_update_admin ON waitlist_signups
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY waitlist_signups_delete_admin ON waitlist_signups
  FOR DELETE USING (auth.role() = 'authenticated');
