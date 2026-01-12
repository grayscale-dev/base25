-- Avoid RLS recursion in helper functions by bypassing row security.
CREATE OR REPLACE FUNCTION email_matches_board_rule(board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
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
SECURITY DEFINER
SET search_path = public
SET row_security = off
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
SECURITY DEFINER
SET search_path = public
SET row_security = off
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
