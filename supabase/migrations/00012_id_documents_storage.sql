-- ============================================================
-- Phase 11: storage bucket for instructor ID documents
--
-- Path convention: id-documents/{user_id}/{uuid}.{ext}
--
-- NOTE: this bucket is PUBLIC for demo simplicity. In production
-- these are PII and should live in a private bucket with admin
-- access mediated by signed URLs. Swap `public=false` and switch
-- the admin applications page to signed URLs when productizing.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('id-documents', 'id-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view id documents" ON storage.objects;
CREATE POLICY "Anyone can view id documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'id-documents');

DROP POLICY IF EXISTS "Users upload id docs to their own folder" ON storage.objects;
CREATE POLICY "Users upload id docs to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete their own id docs" ON storage.objects;
CREATE POLICY "Users delete their own id docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
