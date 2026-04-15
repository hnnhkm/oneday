-- ============================================================
-- Phase 5: Instructor side
-- Adds: rejection_reason on applications, activity-images storage bucket + policies
-- Note: idx_notifications_user_read already exists from 00001.
-- ============================================================

-- Rejection reason surfaced on /instructor/rejected page
ALTER TABLE public.instructor_profiles
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 00001 only has UPDATE/SELECT/INSERT policies on activities for
-- instructors; the delete flow in Phase 5 needs a DELETE policy too.
DROP POLICY IF EXISTS "Instructors can delete their own activities" ON public.activities;
CREATE POLICY "Instructors can delete their own activities"
  ON public.activities FOR DELETE
  USING (
    instructor_id IN (
      SELECT id FROM public.instructor_profiles WHERE user_id = auth.uid()
    )
  );

-- Storage bucket for activity cover + gallery images
INSERT INTO storage.buckets (id, name, public)
VALUES ('activity-images', 'activity-images', true)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {instructor_profile_id}/{uuid}.jpg
-- Public SELECT so <Image> tags work without signed URLs.
DROP POLICY IF EXISTS "Anyone can view activity images" ON storage.objects;
CREATE POLICY "Anyone can view activity images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'activity-images');

DROP POLICY IF EXISTS "Approved instructors upload to their own folder" ON storage.objects;
CREATE POLICY "Approved instructors upload to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'activity-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.instructor_profiles
      WHERE user_id = auth.uid() AND approval_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Instructors delete their own activity images" ON storage.objects;
CREATE POLICY "Instructors delete their own activity images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'activity-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.instructor_profiles
      WHERE user_id = auth.uid()
    )
  );
