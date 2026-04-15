-- Allow users to read any activity they have booked, even if the activity
-- is no longer published (e.g. status 'completed' for past editions).
-- This is required for /bookings to show past/cancelled bookings, because
-- the page joins activities!inner and the default activities SELECT policy
-- only matches status='published'.
--
-- We must avoid recursive RLS: a naive policy that subqueries `bookings`
-- triggers infinite recursion because the bookings SELECT policies
-- themselves reference `activities` (instructor_id join). Wrap the lookup
-- in a SECURITY DEFINER function that bypasses RLS for the membership check.

CREATE OR REPLACE FUNCTION public.user_has_booking_for_activity(
  p_user_id uuid,
  p_activity_id uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE user_id = p_user_id AND activity_id = p_activity_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_booking_for_activity(uuid, uuid) TO authenticated;

CREATE POLICY "Users can read activities they have booked"
  ON public.activities
  FOR SELECT
  USING (public.user_has_booking_for_activity(auth.uid(), id));
