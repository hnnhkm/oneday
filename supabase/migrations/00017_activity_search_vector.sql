-- ============================================================
-- Activity search scope: tsvector + unaccent + rank RPC
-- Replaces the ILIKE .or() path in fetchActivities with a real
-- full-text index, cross-locale matching, accent folding, and
-- relevance ranking.
-- ============================================================

-- 1. unaccent extension + IMMUTABLE wrapper.
-- unaccent() is STABLE by default so it cannot be used inside a
-- generated column or a functional index directly. Wrapping it in
-- our own SQL function with an explicit regdictionary argument
-- makes it IMMUTABLE-safe. We do NOT put SET search_path on this
-- function because a SET clause blocks SQL-function inlining, and
-- inlining is what lets the planner use it inside the generated
-- column. Instead, the dictionary name is explicitly qualified.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, $1);
$$;

-- 2. Generated tsvector column on activities.
-- All three locales are fanned into a single vector with weight A
-- for title, B for description, C for neighborhood/city. Portuguese
-- stemming is applied to every locale — benign on en/es (words pass
-- through mostly unchanged) and essential for pt ("cerâmicas" -> "cerâmic"
-- matches "cerâmica"). unaccent makes "ceramica" match "cerâmica".
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(title->>'pt',''))), 'A') ||
    setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(title->>'en',''))), 'A') ||
    setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(title->>'es',''))), 'A') ||
    setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(description->>'pt',''))), 'B') ||
    setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(description->>'en',''))), 'B') ||
    setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(description->>'es',''))), 'B') ||
    setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(neighborhood,''))), 'C') ||
    setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(city,''))), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_activities_search_vector
  ON public.activities USING GIN (search_vector);

-- 3. Thin RPC that returns (id, rank) pairs for a search query.
-- The app composes this with all the other filters client-side by
-- passing the returned ids through .in('id', ids). We ORDER BY rank
-- and LIMIT 500 inside the RPC so the worst case is bounded; at our
-- scale this will not truncate real searches. SECURITY INVOKER +
-- the status='published' predicate keeps drafts out regardless of
-- caller; RLS on the activities table applies normally.
CREATE OR REPLACE FUNCTION public.search_activities_rank(q text)
  RETURNS TABLE(id uuid, rank real)
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = public
AS $$
  SELECT a.id,
         ts_rank(a.search_vector,
                 websearch_to_tsquery('portuguese', public.f_unaccent(q))) AS rank
  FROM public.activities a
  WHERE a.status = 'published'
    AND a.search_vector @@ websearch_to_tsquery('portuguese', public.f_unaccent(q))
  ORDER BY rank DESC
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.search_activities_rank(text) TO anon, authenticated;
