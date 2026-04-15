-- Admin-curated "Featured" flag for the homepage Atividades em destaque
-- strip. Mirrors the categories.show_on_home column from 00024 but
-- defaults to FALSE because activities are instructor-created content
-- and we don't want every new row auto-featured — the admin explicitly
-- opts each one in from /admin/activities.
--
-- RLS already grants admins ALL on activities, so the new flag
-- inherits the correct write gating without extra policies.
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS featured_on_home BOOLEAN NOT NULL DEFAULT false;

-- Partial index matches the homepage filter pattern and stays tiny
-- (only featured rows get an entry).
CREATE INDEX IF NOT EXISTS activities_featured_on_home_idx
  ON public.activities(featured_on_home)
  WHERE featured_on_home = true;
