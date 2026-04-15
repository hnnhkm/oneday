-- Admins can now curate which categories appear in the homepage grid.
-- `show_on_home=true` by default so the rollout is a no-op: every
-- existing category keeps showing until an admin explicitly hides it.
-- RLS on `categories` already grants admin ALL + public SELECT, so the
-- new column inherits the correct access — no policy changes needed.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS show_on_home BOOLEAN NOT NULL DEFAULT true;

-- Partial index so the homepage filter doesn't need a seq scan once
-- the table grows. Cheap — 19 rows today but keeps the query plan
-- consistent as the taxonomy evolves.
CREATE INDEX IF NOT EXISTS categories_show_on_home_idx
  ON public.categories(show_on_home)
  WHERE show_on_home = true;
