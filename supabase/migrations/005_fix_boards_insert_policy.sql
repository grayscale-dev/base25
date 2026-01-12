DROP POLICY IF EXISTS boards_insert_authenticated ON boards;

CREATE POLICY boards_insert_authenticated ON boards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
