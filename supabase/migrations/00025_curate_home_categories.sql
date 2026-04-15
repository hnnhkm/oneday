-- Seed the initial homepage curation: 8 categories visible, the rest
-- hidden. Picked for breadth of experience types (food, nature, art,
-- wellness, culture, movement) rather than raw catalog counts so the
-- home grid reads as a sampler regardless of which instructors are
-- active right now. Admins can edit this freely at /admin/categories
-- after the rollout.
--
-- Ordering note: we unset everything to false first, then promote the
-- eight winners. This keeps the migration idempotent even if someone
-- runs it after already editing a row in prod (we still end in a
-- known state).

UPDATE public.categories SET show_on_home = false;

UPDATE public.categories SET show_on_home = true
WHERE slug IN (
  'cooking',
  'outdoors',
  'art-workshops',
  'wellness',
  'cultural-tours',
  'dining',
  'food-tours',
  'workouts'
);
