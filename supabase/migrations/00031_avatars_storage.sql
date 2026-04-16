-- ============================================================
-- Avatars storage bucket
--
-- Lets any authenticated user (student or instructor) upload their
-- own profile photo. Path convention mirrors review-photos:
--   avatars/{user_id}/{uuid}.jpg
-- The folder-prefix check in the INSERT policy enforces "you can
-- only write into your own folder" without needing a subquery.
--
-- Public SELECT is fine because `users.avatar_url` is already
-- readable across the app (public profiles, instructor pages, etc.)
-- and the filename is a UUID so the URL is effectively unguessable
-- until the user publishes it.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload avatars to their own folder" ON storage.objects;
CREATE POLICY "Users upload avatars to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update their own avatars" ON storage.objects;
CREATE POLICY "Users update their own avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete their own avatars" ON storage.objects;
CREATE POLICY "Users delete their own avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
