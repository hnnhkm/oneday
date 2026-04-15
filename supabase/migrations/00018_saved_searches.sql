-- ============================================================
-- Phase 14: Saved searches / "notify me when matching"
--
-- Users save a set of filters (category, neighborhood, price
-- range, search text). The daily cron runs queue_saved_search_matches
-- which finds published activities created since the last check,
-- tests each against every saved search's filters, and inserts a
-- saved_search_matched notification for each hit. The dispatcher
-- then emails the user.
-- ============================================================

-- 1. New notification type.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'saved_search_matched';

-- 2. Saved searches table.
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  last_matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_search_name UNIQUE (user_id, name)
);

CREATE INDEX idx_saved_searches_user ON public.saved_searches(user_id);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own saved searches"
  ON public.saved_searches FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create saved searches"
  ON public.saved_searches FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own saved searches"
  ON public.saved_searches FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own saved searches"
  ON public.saved_searches FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Admin full access to saved searches"
  ON public.saved_searches FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

-- 3. RPC: match new activities against saved searches.
--
-- For each saved search, find published activities whose
-- created_at > last_matched_at and that match the saved filters.
-- Insert one notification per (user, activity) pair, deduped by
-- checking for an existing notification with the same body text.
-- Update last_matched_at so the next run only looks at newer
-- activities.
--
-- Returns a table of affected user IDs so the cron endpoint can
-- drain their email queues.

CREATE OR REPLACE FUNCTION public.queue_saved_search_matches()
RETURNS TABLE(affected_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search RECORD;
  v_activity RECORD;
  v_cat_ids UUID[];
  v_neighborhood TEXT;
  v_min_price INT;
  v_max_price INT;
  v_search_text TEXT;
  v_now TIMESTAMPTZ := now();
  v_matched_users UUID[] := '{}';
BEGIN
  FOR v_search IN
    SELECT id, user_id, name, filters, last_matched_at
    FROM public.saved_searches
  LOOP
    -- Parse filters from JSONB.
    v_cat_ids := CASE
      WHEN v_search.filters ? 'categoryIds'
        AND jsonb_typeof(v_search.filters->'categoryIds') = 'array'
        AND jsonb_array_length(v_search.filters->'categoryIds') > 0
      THEN ARRAY(
        SELECT (e.value #>> '{}')::UUID
        FROM jsonb_array_elements(v_search.filters->'categoryIds') AS e(value)
      )
      ELSE NULL
    END;

    v_neighborhood := NULLIF(TRIM(v_search.filters->>'neighborhood'), '');
    v_min_price := (v_search.filters->>'minPrice')::INT;
    v_max_price := (v_search.filters->>'maxPrice')::INT;
    v_search_text := NULLIF(TRIM(v_search.filters->>'search'), '');

    FOR v_activity IN
      SELECT a.id, COALESCE(a.title->>'pt', 'atividade') AS title_pt
      FROM public.activities a
      WHERE a.status = 'published'
        AND a.date >= CURRENT_DATE
        AND a.created_at > v_search.last_matched_at
        -- Category filter
        AND (v_cat_ids IS NULL OR a.category_id = ANY(v_cat_ids))
        -- Neighborhood filter
        AND (v_neighborhood IS NULL OR a.neighborhood = v_neighborhood)
        -- Price range
        AND (v_min_price IS NULL OR a.price_cents >= v_min_price)
        AND (v_max_price IS NULL OR a.price_cents <= v_max_price)
        -- Text search via tsvector (if the user saved a search term)
        AND (
          v_search_text IS NULL
          OR a.search_vector @@ websearch_to_tsquery(
            'portuguese', public.f_unaccent(v_search_text)
          )
        )
    LOOP
      -- Dedupe: skip if we already notified this user about this activity.
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_search.user_id
          AND n.type = 'saved_search_matched'
          AND n.body LIKE '%' || v_activity.id::TEXT || '%'
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, body, channel)
        VALUES (
          v_search.user_id,
          'saved_search_matched',
          format('Nova atividade: %s', v_activity.title_pt),
          format(
            'A atividade "%s" corresponde à sua busca salva "%s". [%s]',
            v_activity.title_pt, v_search.name, v_activity.id
          ),
          'in_app'
        );

        IF NOT (v_search.user_id = ANY(v_matched_users)) THEN
          v_matched_users := v_matched_users || v_search.user_id;
        END IF;
      END IF;
    END LOOP;

    -- Advance the cursor so the next run only checks newer activities.
    UPDATE public.saved_searches
    SET last_matched_at = v_now
    WHERE id = v_search.id;
  END LOOP;

  RETURN QUERY SELECT unnest(v_matched_users);
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_saved_search_matches() TO service_role;
