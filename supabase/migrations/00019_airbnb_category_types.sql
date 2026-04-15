-- Replace the seeded category taxonomy with Airbnb Experiences' "Type" list
-- (19 categories). UUIDs 001-00a are reused (existing activities keep their
-- FK references valid with new labels); 00b-013 are added.

-- Update existing 10 rows (cooking/beauty/wellness keep their meaning;
-- the rest are relabeled to the closest Airbnb type).
UPDATE public.categories SET name = '{"pt": "Culinária", "en": "Cooking", "es": "Cocina"}'::jsonb,                                slug = 'cooking',          icon = '🍳' WHERE id = '10000000-0000-0000-0000-000000000001';
UPDATE public.categories SET name = '{"pt": "Natureza", "en": "Outdoors", "es": "Aire libre"}'::jsonb,                           slug = 'outdoors',         icon = '⛰️' WHERE id = '10000000-0000-0000-0000-000000000002';
UPDATE public.categories SET name = '{"pt": "Oficinas de arte", "en": "Art workshops", "es": "Talleres de arte"}'::jsonb,        slug = 'art-workshops',    icon = '🎨' WHERE id = '10000000-0000-0000-0000-000000000003';
UPDATE public.categories SET name = '{"pt": "Beleza", "en": "Beauty", "es": "Belleza"}'::jsonb,                                  slug = 'beauty',           icon = '💄' WHERE id = '10000000-0000-0000-0000-000000000004';
UPDATE public.categories SET name = '{"pt": "Galerias", "en": "Galleries", "es": "Galerías"}'::jsonb,                            slug = 'galleries',        icon = '🖼️' WHERE id = '10000000-0000-0000-0000-000000000005';
UPDATE public.categories SET name = '{"pt": "Apresentações", "en": "Performances", "es": "Actuaciones"}'::jsonb,                 slug = 'performances',     icon = '🎭' WHERE id = '10000000-0000-0000-0000-000000000006';
UPDATE public.categories SET name = '{"pt": "Compras e moda", "en": "Shopping & fashion", "es": "Compras y moda"}'::jsonb,       slug = 'shopping-fashion', icon = '🛍️' WHERE id = '10000000-0000-0000-0000-000000000007';
UPDATE public.categories SET name = '{"pt": "Bem-estar", "en": "Wellness", "es": "Bienestar"}'::jsonb,                           slug = 'wellness',         icon = '🧘' WHERE id = '10000000-0000-0000-0000-000000000008';
UPDATE public.categories SET name = '{"pt": "Esportes aquáticos", "en": "Water sports", "es": "Deportes acuáticos"}'::jsonb,     slug = 'water-sports',     icon = '🏄' WHERE id = '10000000-0000-0000-0000-000000000009';
UPDATE public.categories SET name = '{"pt": "Passeios culturais", "en": "Cultural tours", "es": "Tours culturales"}'::jsonb,     slug = 'cultural-tours',   icon = '🏛️' WHERE id = '10000000-0000-0000-0000-00000000000a';

-- Add 9 new categories to complete the Airbnb type list.
INSERT INTO public.categories (id, name, slug, icon) VALUES
  ('10000000-0000-0000-0000-00000000000b', '{"pt": "Arquitetura", "en": "Architecture", "es": "Arquitectura"}'::jsonb,           'architecture', '🏛️'),
  ('10000000-0000-0000-0000-00000000000c', '{"pt": "Gastronomia", "en": "Dining", "es": "Gastronomía"}'::jsonb,                  'dining', '🍽️'),
  ('10000000-0000-0000-0000-00000000000d', '{"pt": "Voo", "en": "Flying", "es": "Vuelo"}'::jsonb,                                'flying', '✈️'),
  ('10000000-0000-0000-0000-00000000000e', '{"pt": "Tours gastronômicos", "en": "Food tours", "es": "Tours gastronómicos"}'::jsonb, 'food-tours', '🍴'),
  ('10000000-0000-0000-0000-00000000000f', '{"pt": "Pontos turísticos", "en": "Landmarks", "es": "Monumentos"}'::jsonb,          'landmarks', '🗿'),
  ('10000000-0000-0000-0000-000000000010', '{"pt": "Museus", "en": "Museums", "es": "Museos"}'::jsonb,                           'museums', '🏛️'),
  ('10000000-0000-0000-0000-000000000011', '{"pt": "Degustações", "en": "Tastings", "es": "Degustaciones"}'::jsonb,              'tastings', '🍷'),
  ('10000000-0000-0000-0000-000000000012', '{"pt": "Vida selvagem", "en": "Wildlife", "es": "Vida silvestre"}'::jsonb,           'wildlife', '🦋'),
  ('10000000-0000-0000-0000-000000000013', '{"pt": "Treinos", "en": "Workouts", "es": "Entrenamientos"}'::jsonb,                 'workouts', '💪')
ON CONFLICT (id) DO NOTHING;
