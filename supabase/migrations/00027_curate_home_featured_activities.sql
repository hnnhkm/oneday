-- Seed the initial "Atividades em destaque" curation: pre-promote the
-- first 10 of our 12 seeded published activities. Admins can revise
-- freely at /admin/activities after rollout.
--
-- Idempotent shape mirrors 00025: reset everything to false first,
-- then flip the chosen IDs. Keeps the end state deterministic even if
-- an admin edited a row in prod before this migration ran.

UPDATE public.activities SET featured_on_home = false;

UPDATE public.activities SET featured_on_home = true
WHERE id IN (
  '50000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000003',
  '50000000-0000-0000-0000-000000000004',
  '50000000-0000-0000-0000-000000000005',
  '50000000-0000-0000-0000-000000000006',
  '50000000-0000-0000-0000-000000000007',
  '50000000-0000-0000-0000-000000000008',
  '50000000-0000-0000-0000-000000000009',
  '50000000-0000-0000-0000-00000000000a'
);
