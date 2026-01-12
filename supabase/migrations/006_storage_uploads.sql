INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', TRUE)
ON CONFLICT (id) DO UPDATE
SET public = TRUE;

CREATE POLICY "uploads_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "uploads_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads' AND owner = auth.uid())
WITH CHECK (bucket_id = 'uploads' AND owner = auth.uid());

CREATE POLICY "uploads_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'uploads' AND owner = auth.uid());
