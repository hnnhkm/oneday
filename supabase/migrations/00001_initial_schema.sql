-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('user', 'instructor', 'admin');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE activity_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'completed');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');
CREATE TYPE cancellation_policy AS ENUM ('flexible', 'moderate', 'strict');
CREATE TYPE payout_status AS ENUM ('pending', 'paid', 'failed');
CREATE TYPE preferred_language AS ENUM ('pt', 'en', 'es');
CREATE TYPE notification_type AS ENUM (
  'booking_confirmed', 'booking_cancelled', 'activity_reminder',
  'review_prompt', 'no_show_charged', 'instructor_approved',
  'instructor_rejected', 'payout_sent', 'activity_flagged'
);
CREATE TYPE notification_channel AS ENUM ('email', 'whatsapp', 'in_app');

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  preferred_language preferred_language NOT NULL DEFAULT 'pt',
  role user_role NOT NULL DEFAULT 'user',
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.instructor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  bio TEXT NOT NULL DEFAULT '',
  specialties TEXT[] NOT NULL DEFAULT '{}',
  social_links JSONB NOT NULL DEFAULT '{}',
  id_document_url TEXT,
  approval_status approval_status NOT NULL DEFAULT 'pending',
  commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.15,
  stripe_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name JSONB NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT NOT NULL DEFAULT '📌'
);

CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name JSONB NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.instructor_profiles(id) ON DELETE CASCADE,
  title JSONB NOT NULL,
  description JSONB NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id),
  tags TEXT[] NOT NULL DEFAULT '{}',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  address TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  max_seats INTEGER NOT NULL CHECK (max_seats > 0),
  seats_remaining INTEGER NOT NULL CHECK (seats_remaining >= 0),
  cover_image_url TEXT NOT NULL,
  gallery_image_urls TEXT[] NOT NULL DEFAULT '{}',
  cancellation_policy cancellation_policy NOT NULL DEFAULT 'flexible',
  cancellation_policy_text TEXT,
  no_show_fee_cents INTEGER CHECK (no_show_fee_cents >= 0),
  status activity_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seats_remaining_lte_max CHECK (seats_remaining <= max_seats)
);

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  seats_booked INTEGER NOT NULL CHECK (seats_booked > 0),
  total_price_cents INTEGER NOT NULL CHECK (total_price_cents >= 0),
  status booking_status NOT NULL DEFAULT 'confirmed',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_id TEXT,
  no_show BOOLEAN NOT NULL DEFAULT false,
  no_show_fee_charged BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_review_per_user_activity UNIQUE (user_id, activity_id)
);

CREATE TABLE public.review_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_activity_favorite UNIQUE (user_id, activity_id)
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel notification_channel NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT unique_user_notification_pref UNIQUE (user_id, notification_type)
);

CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.instructor_profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  commission_cents INTEGER NOT NULL CHECK (commission_cents >= 0),
  stripe_transfer_id TEXT,
  status payout_status NOT NULL DEFAULT 'pending',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.instructor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.instructor_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_activities_category ON public.activities(category_id);
CREATE INDEX idx_activities_instructor ON public.activities(instructor_id);
CREATE INDEX idx_activities_date ON public.activities(date);
CREATE INDEX idx_activities_status ON public.activities(status);
CREATE INDEX idx_activities_city ON public.activities(city);
CREATE INDEX idx_activities_neighborhood ON public.activities(neighborhood);
CREATE INDEX idx_activities_location ON public.activities(latitude, longitude);
CREATE INDEX idx_bookings_user ON public.bookings(user_id);
CREATE INDEX idx_bookings_activity ON public.bookings(activity_id);
CREATE INDEX idx_reviews_activity ON public.reviews(activity_id);
CREATE INDEX idx_reviews_user ON public.reviews(user_id);
CREATE INDEX idx_favorites_user ON public.favorites(user_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX idx_payouts_instructor ON public.payouts(instructor_id);
CREATE INDEX idx_instructor_profiles_status ON public.instructor_profiles(approval_status);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_instructor_profiles_updated_at
  BEFORE UPDATE ON public.instructor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_availability ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "Users can read their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Public profiles are readable" ON public.users FOR SELECT USING (true);
CREATE POLICY "Admin full access to users" ON public.users FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Public can read approved instructor profiles" ON public.instructor_profiles FOR SELECT USING (approval_status = 'approved');
CREATE POLICY "Instructors can read their own profile" ON public.instructor_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create their own instructor application" ON public.instructor_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Instructors can update their own profile" ON public.instructor_profiles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin full access to instructor profiles" ON public.instructor_profiles FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Anyone can read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admin can manage categories" ON public.categories FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Anyone can read tags" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Admin can manage tags" ON public.tags FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Anyone can read published activities" ON public.activities FOR SELECT USING (status = 'published');
CREATE POLICY "Instructors can read their own activities" ON public.activities FOR SELECT USING (instructor_id IN (SELECT id FROM public.instructor_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Instructors can create activities" ON public.activities FOR INSERT WITH CHECK (instructor_id IN (SELECT id FROM public.instructor_profiles WHERE user_id = auth.uid() AND approval_status = 'approved'));
CREATE POLICY "Instructors can update their own activities" ON public.activities FOR UPDATE USING (instructor_id IN (SELECT id FROM public.instructor_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin full access to activities" ON public.activities FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can read their own bookings" ON public.bookings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create bookings" ON public.bookings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own bookings" ON public.bookings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Instructors can read bookings for their activities" ON public.bookings FOR SELECT USING (activity_id IN (SELECT a.id FROM public.activities a JOIN public.instructor_profiles ip ON a.instructor_id = ip.id WHERE ip.user_id = auth.uid()));
CREATE POLICY "Instructors can update bookings for their activities" ON public.bookings FOR UPDATE USING (activity_id IN (SELECT a.id FROM public.activities a JOIN public.instructor_profiles ip ON a.instructor_id = ip.id WHERE ip.user_id = auth.uid()));
CREATE POLICY "Admin full access to bookings" ON public.bookings FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Anyone can read reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews for attended activities" ON public.reviews FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.bookings b JOIN public.activities a ON b.activity_id = a.id WHERE b.user_id = auth.uid() AND b.activity_id = activity_id AND b.status = 'completed' AND a.date < CURRENT_DATE));
CREATE POLICY "Admin full access to reviews" ON public.reviews FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Anyone can read review photos" ON public.review_photos FOR SELECT USING (true);
CREATE POLICY "Review authors can add photos" ON public.review_photos FOR INSERT WITH CHECK (review_id IN (SELECT id FROM public.reviews WHERE user_id = auth.uid()));
CREATE POLICY "Admin full access to review photos" ON public.review_photos FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can read their own favorites" ON public.favorites FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage their own favorites" ON public.favorites FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own favorites" ON public.favorites FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can read their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin full access to notifications" ON public.notifications FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can read their own preferences" ON public.notification_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage their own preferences" ON public.notification_preferences FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Instructors can read their own payouts" ON public.payouts FOR SELECT USING (instructor_id IN (SELECT id FROM public.instructor_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin full access to payouts" ON public.payouts FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Instructors can manage their own availability" ON public.instructor_availability FOR ALL USING (instructor_id IN (SELECT id FROM public.instructor_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin full access to availability" ON public.instructor_availability FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.phone,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
