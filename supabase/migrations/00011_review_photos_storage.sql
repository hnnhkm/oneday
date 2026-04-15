-- ============================================================
-- Phase 10: storage bucket for review photos
--
-- The review_photos table already exists in 00001 with public
-- SELECT + author-INSERT RLS; this migration just adds the bucket
-- and the matching storage-object policies. Path convention:
--   review-photos/{user_id}/{uuid}.jpg
-- where user_id is the review author — that lets the INSERT
-- policy cheaply check ownership via the folder prefix without a
-- subquery against public.reviews.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view review photos" ON storage.objects;
CREATE POLICY "Anyone can view review photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-photos');

DROP POLICY IF EXISTS "Users upload review photos to their own folder" ON storage.objects;
CREATE POLICY "Users upload review photos to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'review-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete their own review photos" ON storage.objects;
CREATE POLICY "Users delete their own review photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'review-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
