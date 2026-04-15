-- ============================================================
-- CATEGORIES
-- ============================================================
-- 19 categories matching Airbnb Experiences "Type" taxonomy.
-- UUIDs 001-00a reuse existing slots (with relabeled categories) so demo
-- activities in this seed keep valid FK references; 00b-00m are new.
INSERT INTO public.categories (id, name, slug, icon) VALUES
  ('10000000-0000-0000-0000-000000000001', '{"pt": "Culinária", "en": "Cooking", "es": "Cocina"}', 'cooking', '🍳'),
  ('10000000-0000-0000-0000-000000000002', '{"pt": "Natureza", "en": "Outdoors", "es": "Aire libre"}', 'outdoors', '⛰️'),
  ('10000000-0000-0000-0000-000000000003', '{"pt": "Oficinas de arte", "en": "Art workshops", "es": "Talleres de arte"}', 'art-workshops', '🎨'),
  ('10000000-0000-0000-0000-000000000004', '{"pt": "Beleza", "en": "Beauty", "es": "Belleza"}', 'beauty', '💄'),
  ('10000000-0000-0000-0000-000000000005', '{"pt": "Galerias", "en": "Galleries", "es": "Galerías"}', 'galleries', '🖼️'),
  ('10000000-0000-0000-0000-000000000006', '{"pt": "Apresentações", "en": "Performances", "es": "Actuaciones"}', 'performances', '🎭'),
  ('10000000-0000-0000-0000-000000000007', '{"pt": "Compras e moda", "en": "Shopping & fashion", "es": "Compras y moda"}', 'shopping-fashion', '🛍️'),
  ('10000000-0000-0000-0000-000000000008', '{"pt": "Bem-estar", "en": "Wellness", "es": "Bienestar"}', 'wellness', '🧘'),
  ('10000000-0000-0000-0000-000000000009', '{"pt": "Esportes aquáticos", "en": "Water sports", "es": "Deportes acuáticos"}', 'water-sports', '🏄'),
  ('10000000-0000-0000-0000-00000000000a', '{"pt": "Passeios culturais", "en": "Cultural tours", "es": "Tours culturales"}', 'cultural-tours', '🏛️'),
  ('10000000-0000-0000-0000-00000000000b', '{"pt": "Arquitetura", "en": "Architecture", "es": "Arquitectura"}', 'architecture', '🏛️'),
  ('10000000-0000-0000-0000-00000000000c', '{"pt": "Gastronomia", "en": "Dining", "es": "Gastronomía"}', 'dining', '🍽️'),
  ('10000000-0000-0000-0000-00000000000d', '{"pt": "Voo", "en": "Flying", "es": "Vuelo"}', 'flying', '✈️'),
  ('10000000-0000-0000-0000-00000000000e', '{"pt": "Tours gastronômicos", "en": "Food tours", "es": "Tours gastronómicos"}', 'food-tours', '🍴'),
  ('10000000-0000-0000-0000-00000000000f', '{"pt": "Pontos turísticos", "en": "Landmarks", "es": "Monumentos"}', 'landmarks', '🗿'),
  ('10000000-0000-0000-0000-000000000010', '{"pt": "Museus", "en": "Museums", "es": "Museos"}', 'museums', '🏛️'),
  ('10000000-0000-0000-0000-000000000011', '{"pt": "Degustações", "en": "Tastings", "es": "Degustaciones"}', 'tastings', '🍷'),
  ('10000000-0000-0000-0000-000000000012', '{"pt": "Vida selvagem", "en": "Wildlife", "es": "Vida silvestre"}', 'wildlife', '🦋'),
  ('10000000-0000-0000-0000-000000000013', '{"pt": "Treinos", "en": "Workouts", "es": "Entrenamientos"}', 'workouts', '💪');

-- ============================================================
-- TAGS
-- ============================================================
INSERT INTO public.tags (name, slug) VALUES
  ('{"pt": "Para iniciantes", "en": "Beginner-friendly", "es": "Para principiantes"}', 'beginner-friendly'),
  ('{"pt": "Ao ar livre", "en": "Outdoor", "es": "Al aire libre"}', 'outdoor'),
  ('{"pt": "Indoor", "en": "Indoor", "es": "Interior"}', 'indoor'),
  ('{"pt": "Encontro", "en": "Date night", "es": "Cita nocturna"}', 'date-night'),
  ('{"pt": "Para crianças", "en": "Kids welcome", "es": "Niños bienvenidos"}', 'kids-welcome'),
  ('{"pt": "Em grupo", "en": "Group activity", "es": "Actividad grupal"}', 'group-activity'),
  ('{"pt": "Individual", "en": "Solo", "es": "Individual"}', 'solo'),
  ('{"pt": "Final de semana", "en": "Weekend", "es": "Fin de semana"}', 'weekend'),
  ('{"pt": "Noturno", "en": "Evening", "es": "Nocturno"}', 'evening'),
  ('{"pt": "Vegano", "en": "Vegan", "es": "Vegano"}', 'vegan');

-- ============================================================
-- AUTH USERS (triggers will auto-populate public.users)
-- ============================================================
-- Instructors
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'mariana@example.com', crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Mariana Silva","avatar_url":"https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400"}',
    now() - interval '180 days', now(), '', '', '', ''
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'rafael@example.com', crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Rafael Costa","avatar_url":"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"}',
    now() - interval '220 days', now(), '', '', '', ''
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'julia@example.com', crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Júlia Almeida","avatar_url":"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400"}',
    now() - interval '120 days', now(), '', '', '', ''
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'bruno@example.com', crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Bruno Oliveira","avatar_url":"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400"}',
    now() - interval '300 days', now(), '', '', '', ''
  ),
  -- Beatriz has a pending instructor application so /admin/applications
  -- has something to approve on a fresh seed.
  (
    '20000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'beatriz@example.com', crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Beatriz Lima","avatar_url":"https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400"}',
    now() - interval '10 days', now(), '', '', '', ''
  ),
  -- Admin user for exercising /admin/* in local dev. Promoted below
  -- to role='admin' once the users row is created by the trigger.
  (
    '10000000-aaaa-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin@example.com', crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin Demo","avatar_url":"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400"}',
    now() - interval '365 days', now(), '', '', '', ''
  ),
-- Regular users (for reviews)
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'ana@example.com', crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ana Souza","avatar_url":"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400"}',
    now() - interval '90 days', now(), '', '', '', ''
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'carlos@example.com', crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Carlos Pereira","avatar_url":"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400"}',
    now() - interval '60 days', now(), '', '', '', ''
  );

-- Promote approved instructors to role=instructor.
-- Beatriz (20000000-...0005) is intentionally left as role=user because her
-- instructor_profile is still pending and shouldn't behave as an instructor yet.
UPDATE public.users SET role = 'instructor'
WHERE id IN (
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000004'
);

-- Promote Admin Demo to role='admin' so /admin/* is reachable on seed.
UPDATE public.users SET role = 'admin'
WHERE id = '10000000-aaaa-0000-0000-000000000001';

-- ============================================================
-- INSTRUCTOR PROFILES
-- ============================================================
INSERT INTO public.instructor_profiles (id, user_id, bio, specialties, approval_status) VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Chef formada pela Le Cordon Bleu com 12 anos de experiência em culinária brasileira contemporânea. Apaixonada por ingredientes locais e sazonais.',
    ARRAY['Culinária brasileira', 'Doces', 'Massas artesanais'],
    'approved'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Fotógrafo profissional especializado em retrato urbano. Ensino técnicas de composição e uso de luz natural há 8 anos.',
    ARRAY['Fotografia de rua', 'Retrato', 'Edição Lightroom'],
    'approved'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    'Artista plástica e ilustradora. Atelier aberto para aulas de aquarela, desenho e cerâmica.',
    ARRAY['Aquarela', 'Cerâmica', 'Ilustração botânica'],
    'approved'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000004',
    'Instrutor de yoga certificado (RYT 500) e especialista em meditação mindfulness. Aulas para todos os níveis.',
    ARRAY['Hatha yoga', 'Vinyasa', 'Meditação'],
    'approved'
  ),
  -- Pending application: exercises the dev approval flow on fresh seed.
  (
    '40000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000005',
    'Ceramista há 6 anos, especializada em peças utilitárias inspiradas na cerâmica Marajoara. Atelier próprio na Vila Mariana.',
    ARRAY['Cerâmica', 'Torno', 'Esmaltação'],
    'pending'
  );

-- ============================================================
-- ACTIVITIES (São Paulo, future dates)
-- ============================================================
INSERT INTO public.activities (
  id, instructor_id, title, description, category_id, tags,
  price_cents, date, time, duration_minutes,
  address, neighborhood, city, state, latitude, longitude,
  max_seats, seats_remaining, cover_image_url, gallery_image_urls,
  cancellation_policy, status
) VALUES
  -- Culinária x Mariana
  (
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '{"pt":"Aula de Culinária Italiana: Massas Frescas","en":"Italian Cooking: Fresh Pasta Class","es":"Cocina Italiana: Pasta Fresca"}',
    '{"pt":"Aprenda a fazer tagliatelle, ravioli e gnocchi do zero, usando técnicas tradicionais. Todos os ingredientes inclusos e jantamos juntos no final.","en":"Learn to make tagliatelle, ravioli and gnocchi from scratch using traditional techniques. All ingredients included and we dine together at the end.","es":"Aprende a hacer tagliatelle, ravioli y gnocchi desde cero."}',
    '10000000-0000-0000-0000-000000000001',
    ARRAY['beginner-friendly','indoor','group-activity'],
    18000, CURRENT_DATE + interval '5 days', '19:00', 180,
    'Rua Augusta, 1200', 'Consolação', 'São Paulo', 'SP', -23.5505, -46.6623,
    8, 5,
    'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1200',
    ARRAY['https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1200','https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=1200'],
    'moderate', 'published'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000001',
    '{"pt":"Doces Brasileiros: Brigadeiros Gourmet","en":"Brazilian Sweets: Gourmet Brigadeiros","es":"Dulces brasileños: Brigadeiros gourmet"}',
    '{"pt":"Um workshop delicioso onde você vai aprender 6 sabores de brigadeiro gourmet e técnicas de confeitaria.","en":"A delicious workshop where you will learn 6 gourmet brigadeiro flavors and confectionery techniques.","es":"Un taller delicioso donde aprenderás 6 sabores de brigadeiro gourmet."}',
    '10000000-0000-0000-0000-000000000001',
    ARRAY['beginner-friendly','indoor','weekend'],
    12000, CURRENT_DATE + interval '12 days', '14:00', 150,
    'Alameda Lorena, 450', 'Jardins', 'São Paulo', 'SP', -23.5629, -46.6646,
    10, 10,
    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=1200',
    ARRAY['https://images.unsplash.com/photo-1587668178277-295251f900ce?w=1200'],
    'flexible', 'published'
  ),
  -- Fotografia x Rafael
  (
    '50000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000002',
    '{"pt":"Fotografia de Rua no Centro de SP","en":"Street Photography in Downtown SP","es":"Fotografía urbana en el centro de SP"}',
    '{"pt":"Caminhada fotográfica pelo centro histórico. Foco em composição, luz natural e storytelling urbano. Traga sua câmera (DSLR, mirrorless ou smartphone).","en":"Photography walk through the historic downtown. Focus on composition, natural light and urban storytelling. Bring your camera (DSLR, mirrorless or smartphone).","es":"Caminata fotográfica por el centro histórico."}',
    '10000000-0000-0000-0000-000000000003',
    ARRAY['outdoor','group-activity','beginner-friendly'],
    15000, CURRENT_DATE + interval '7 days', '09:00', 240,
    'Praça da Sé, s/n', 'Sé', 'São Paulo', 'SP', -23.5505, -46.6333,
    12, 8,
    'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200',
    ARRAY['https://images.unsplash.com/photo-1500051638674-ff996a0ec29e?w=1200','https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=1200'],
    'moderate', 'published'
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000002',
    '{"pt":"Edição no Lightroom para Iniciantes","en":"Lightroom Editing for Beginners","es":"Edición en Lightroom para principiantes"}',
    '{"pt":"Workshop prático de edição de fotos no Adobe Lightroom. Você vai sair com um fluxo de trabalho completo para suas próximas sessões.","en":"Hands-on photo editing workshop in Adobe Lightroom. You will leave with a complete workflow for your next sessions.","es":"Taller práctico de edición de fotos en Adobe Lightroom."}',
    '10000000-0000-0000-0000-000000000003',
    ARRAY['beginner-friendly','indoor','solo'],
    20000, CURRENT_DATE + interval '14 days', '10:00', 180,
    'Rua Oscar Freire, 800', 'Jardins', 'São Paulo', 'SP', -23.5614, -46.6716,
    6, 4,
    'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1200',
    ARRAY[]::text[],
    'flexible', 'published'
  ),
  -- Arte x Júlia
  (
    '50000000-0000-0000-0000-000000000005',
    '40000000-0000-0000-0000-000000000003',
    '{"pt":"Aquarela Botânica: Plantas Tropicais","en":"Botanical Watercolor: Tropical Plants","es":"Acuarela botánica: plantas tropicales"}',
    '{"pt":"Explore o mundo das plantas brasileiras através da aquarela. Técnicas de lavagens, sobreposição e detalhamento. Materiais inclusos.","en":"Explore the world of Brazilian plants through watercolor. Wash, layering and detailing techniques. Materials included.","es":"Explora el mundo de las plantas brasileñas a través de la acuarela."}',
    '10000000-0000-0000-0000-000000000005',
    ARRAY['beginner-friendly','indoor','weekend'],
    14000, CURRENT_DATE + interval '9 days', '15:00', 180,
    'Rua Harmonia, 350', 'Vila Madalena', 'São Paulo', 'SP', -23.5460, -46.6895,
    10, 7,
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200',
    ARRAY['https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1200'],
    'flexible', 'published'
  ),
  (
    '50000000-0000-0000-0000-000000000006',
    '40000000-0000-0000-0000-000000000003',
    '{"pt":"Cerâmica: Sua Primeira Tigela","en":"Pottery: Your First Bowl","es":"Cerámica: Tu primer tazón"}',
    '{"pt":"Introdução ao torno de cerâmica. Em uma tarde você vai modelar e decorar sua própria tigela. Incluímos a queima e você retira em 10 dias.","en":"Introduction to the pottery wheel. In one afternoon you will shape and decorate your own bowl.","es":"Introducción al torno de cerámica."}',
    '10000000-0000-0000-0000-000000000005',
    ARRAY['beginner-friendly','indoor','group-activity'],
    22000, CURRENT_DATE + interval '16 days', '14:00', 210,
    'Rua Harmonia, 350', 'Vila Madalena', 'São Paulo', 'SP', -23.5460, -46.6895,
    6, 2,
    'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=1200',
    ARRAY['https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200'],
    'moderate', 'published'
  ),
  -- Bem-estar x Bruno
  (
    '50000000-0000-0000-0000-000000000007',
    '40000000-0000-0000-0000-000000000004',
    '{"pt":"Yoga ao Amanhecer no Parque Ibirapuera","en":"Sunrise Yoga at Ibirapuera Park","es":"Yoga al amanecer en el Parque Ibirapuera"}',
    '{"pt":"Comece o dia com uma aula de Hatha yoga ao ar livre, seguida de uma meditação guiada. Traga seu tapete. Todos os níveis bem-vindos.","en":"Start the day with an outdoor Hatha yoga class followed by guided meditation. Bring your mat. All levels welcome.","es":"Comienza el día con una clase de Hatha yoga al aire libre."}',
    '10000000-0000-0000-0000-000000000008',
    ARRAY['outdoor','beginner-friendly','group-activity'],
    6000, CURRENT_DATE + interval '3 days', '06:30', 75,
    'Av. Pedro Álvares Cabral, s/n', 'Vila Mariana', 'São Paulo', 'SP', -23.5874, -46.6576,
    20, 15,
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200',
    ARRAY['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200'],
    'flexible', 'published'
  ),
  (
    '50000000-0000-0000-0000-000000000008',
    '40000000-0000-0000-0000-000000000004',
    '{"pt":"Workshop de Meditação Mindfulness","en":"Mindfulness Meditation Workshop","es":"Taller de meditación mindfulness"}',
    '{"pt":"Aprenda técnicas práticas de mindfulness para reduzir o estresse e aumentar o foco no dia a dia. Inclui apostila e áudios guiados.","en":"Learn practical mindfulness techniques to reduce stress and increase focus. Includes handout and guided audios.","es":"Aprende técnicas prácticas de mindfulness."}',
    '10000000-0000-0000-0000-000000000008',
    ARRAY['indoor','beginner-friendly','evening'],
    9000, CURRENT_DATE + interval '20 days', '19:30', 120,
    'Rua Wisard, 305', 'Vila Madalena', 'São Paulo', 'SP', -23.5484, -46.6912,
    15, 15,
    'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1200',
    ARRAY[]::text[],
    'flexible', 'published'
  ),
  -- Jardinagem x Mariana (cross-cat)
  (
    '50000000-0000-0000-0000-000000000009',
    '40000000-0000-0000-0000-000000000001',
    '{"pt":"Horta Urbana em Casa","en":"Urban Home Gardening","es":"Huerta urbana en casa"}',
    '{"pt":"Monte sua horta em espaço pequeno: escolha de vasos, substratos, ervas e hortaliças fáceis. Você leva 3 mudas para casa.","en":"Build your garden in a small space: pot selection, substrates, easy herbs and vegetables. You take 3 seedlings home.","es":"Monta tu huerta en un espacio pequeño."}',
    '10000000-0000-0000-0000-000000000002',
    ARRAY['beginner-friendly','outdoor','weekend','kids-welcome'],
    8000, CURRENT_DATE + interval '11 days', '10:00', 120,
    'Alameda Lorena, 450', 'Jardins', 'São Paulo', 'SP', -23.5629, -46.6646,
    12, 9,
    'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200',
    ARRAY['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200'],
    'flexible', 'published'
  ),
  -- Música (no instructor specialized, use Julia)
  (
    '50000000-0000-0000-0000-00000000000a',
    '40000000-0000-0000-0000-000000000003',
    '{"pt":"Introdução ao Ukulele","en":"Ukulele for Beginners","es":"Introducción al ukulele"}',
    '{"pt":"Em 2 horas você aprende os 4 acordes essenciais e toca sua primeira música. Ukuleles disponíveis para uso na aula.","en":"In 2 hours you learn the 4 essential chords and play your first song. Ukuleles available for use in class.","es":"En 2 horas aprendes los 4 acordes esenciales."}',
    '10000000-0000-0000-0000-000000000006',
    ARRAY['beginner-friendly','indoor','weekend'],
    10000, CURRENT_DATE + interval '19 days', '16:00', 120,
    'Rua Harmonia, 350', 'Vila Madalena', 'São Paulo', 'SP', -23.5460, -46.6895,
    8, 6,
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200',
    ARRAY[]::text[],
    'flexible', 'published'
  ),
  -- Esportes x Bruno
  (
    '50000000-0000-0000-0000-00000000000b',
    '40000000-0000-0000-0000-000000000004',
    '{"pt":"Corrida Guiada no Parque Villa-Lobos","en":"Guided Run at Villa-Lobos Park","es":"Carrera guiada en el Parque Villa-Lobos"}',
    '{"pt":"Corrida em grupo de 5km com acompanhamento de técnica, respiração e pace. Para iniciantes e intermediários.","en":"5km group run with coaching on technique, breathing and pace. For beginners and intermediates.","es":"Carrera en grupo de 5km con acompañamiento."}',
    '10000000-0000-0000-0000-000000000009',
    ARRAY['outdoor','beginner-friendly','group-activity','weekend'],
    5000, CURRENT_DATE + interval '6 days', '07:00', 90,
    'Av. Prof. Fonseca Rodrigues, 2001', 'Alto de Pinheiros', 'São Paulo', 'SP', -23.5478, -46.7241,
    20, 18,
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200',
    ARRAY[]::text[],
    'flexible', 'published'
  ),
  -- Tecnologia x Rafael
  (
    '50000000-0000-0000-0000-00000000000c',
    '40000000-0000-0000-0000-000000000002',
    '{"pt":"Introdução ao Python: Primeira Aplicação","en":"Intro to Python: Your First App","es":"Introducción a Python"}',
    '{"pt":"Do zero até rodar seu primeiro script. Aprenda variáveis, loops, funções e vá para casa com um projeto completo.","en":"From zero to running your first script. Learn variables, loops, functions and go home with a complete project.","es":"Desde cero hasta ejecutar tu primer script."}',
    '10000000-0000-0000-0000-00000000000a',
    ARRAY['beginner-friendly','indoor','evening'],
    16000, CURRENT_DATE + interval '13 days', '19:00', 180,
    'Rua Oscar Freire, 800', 'Jardins', 'São Paulo', 'SP', -23.5614, -46.6716,
    10, 7,
    'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=1200',
    ARRAY[]::text[],
    'strict', 'published'
  );

-- ============================================================
-- BOOKINGS (past-completed, for review eligibility)
-- ============================================================
-- We need completed bookings on past activities for reviews to exist.
-- Insert a couple of past activities + completed bookings to attach reviews.
INSERT INTO public.activities (
  id, instructor_id, title, description, category_id, tags,
  price_cents, date, time, duration_minutes,
  address, neighborhood, city, state, latitude, longitude,
  max_seats, seats_remaining, cover_image_url, gallery_image_urls,
  cancellation_policy, status
) VALUES
  (
    '50000000-0000-0000-0000-00000000001a',
    '40000000-0000-0000-0000-000000000001',
    '{"pt":"Aula de Culinária Italiana: Massas Frescas (passada)","en":"Italian Cooking: Fresh Pasta (past)","es":"Cocina italiana (pasada)"}',
    '{"pt":"Edição passada para seed de avaliações.","en":"Past edition for review seed.","es":"Edición pasada."}',
    '10000000-0000-0000-0000-000000000001',
    ARRAY['beginner-friendly'],
    18000, CURRENT_DATE - interval '20 days', '19:00', 180,
    'Rua Augusta, 1200', 'Consolação', 'São Paulo', 'SP', -23.5505, -46.6623,
    8, 0,
    'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1200',
    ARRAY[]::text[],
    'moderate', 'completed'
  ),
  (
    '50000000-0000-0000-0000-00000000001b',
    '40000000-0000-0000-0000-000000000004',
    '{"pt":"Yoga ao Amanhecer (passada)","en":"Sunrise Yoga (past)","es":"Yoga al amanecer (pasada)"}',
    '{"pt":"Edição passada para seed de avaliações.","en":"Past edition for review seed.","es":"Edición pasada."}',
    '10000000-0000-0000-0000-000000000008',
    ARRAY['outdoor'],
    6000, CURRENT_DATE - interval '15 days', '06:30', 75,
    'Av. Pedro Álvares Cabral, s/n', 'Vila Mariana', 'São Paulo', 'SP', -23.5874, -46.6576,
    20, 0,
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200',
    ARRAY[]::text[],
    'flexible', 'completed'
  );

INSERT INTO public.bookings (user_id, activity_id, seats_booked, total_price_cents, status, payment_status) VALUES
  ('30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000001a', 1, 18000, 'completed', 'paid'),
  ('30000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000001a', 1, 18000, 'completed', 'paid'),
  ('30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000001b', 1, 6000, 'completed', 'paid'),
  ('30000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000001b', 1, 6000, 'completed', 'paid');

-- ============================================================
-- REVIEWS (attached to past completed activities)
-- Reviews are ALSO queried via `fetchActivityReviews` on the live activity detail.
-- But the RLS policy only checks attendance when INSERTING. SELECT is public.
-- To display reviews on the upcoming "Italian Cooking" card, we attach them to the
-- live activity id by copying from the past edition's bookings via service role.
-- For simplicity: seed reviews directly against the future activity_id (SELECT is public).
-- ============================================================
INSERT INTO public.reviews (user_id, activity_id, rating, comment) VALUES
  ('30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 5, 'Experiência incrível! A Mariana é super atenciosa e o jantar no final foi delicioso.'),
  ('30000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 4, 'Muito boa! Saí sabendo fazer massa fresca do zero. Recomendo.'),
  ('30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', 5, 'Começar o dia com yoga no Ibirapuera é mágico. Bruno é um excelente instrutor.'),
  ('30000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', 5, 'Aprendi muito sobre composição em uma única manhã. Vale muito a pena!');
