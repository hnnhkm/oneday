export type UserRole = "user" | "instructor" | "admin";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ActivityStatus = "draft" | "published" | "cancelled" | "completed";
export type BookingStatus = "confirmed" | "cancelled" | "completed";
export type PaymentStatus = "pending" | "paid" | "refunded";
export type CancellationPolicy = "flexible" | "moderate" | "strict";
export type PayoutStatus = "pending" | "paid" | "failed";
export type PreferredLanguage = "pt" | "en" | "es";
export type QuorumState = "pending" | "confirmed" | "at_risk" | "cancelled";

export type NotificationType =
  | "booking_confirmed"
  | "booking_cancelled"
  | "activity_reminder"
  | "review_prompt"
  | "no_show_charged"
  | "instructor_approved"
  | "instructor_rejected"
  | "payout_sent"
  | "activity_flagged"
  | "saved_search_matched"
  | "session_quorum_at_risk"
  | "session_confirmed";

export type NotificationChannel = "email" | "whatsapp" | "in_app";

export interface TranslatedField {
  pt: string;
  en?: string;
  es?: string;
}

export interface SocialLinks {
  instagram?: string;
  youtube?: string;
  facebook?: string;
  website?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  preferred_language: PreferredLanguage;
  role: UserRole;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstructorProfile {
  id: string;
  user_id: string;
  bio: string;
  specialties: string[];
  social_links: SocialLinks;
  id_document_url: string | null;
  approval_status: ApprovalStatus;
  rejection_reason: string | null;
  commission_rate: number;
  stripe_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: TranslatedField;
  slug: string;
  icon: string;
  /**
   * Admin-curated flag. True = include in the homepage CategoryGrid.
   * Defaults to true for every row in migration 00024 so the rollout
   * is transparent; admins uncheck categories to hide them from home
   * without touching the global taxonomy used elsewhere (search,
   * activity form, etc.).
   */
  show_on_home: boolean;
}

export interface Activity {
  id: string;
  instructor_id: string;
  title: TranslatedField;
  description: TranslatedField;
  category_id: string;
  tags: string[];
  price_cents: number;
  date: string;
  time: string;
  duration_minutes: number;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  max_seats: number;
  seats_remaining: number;
  min_participants: number;
  cover_image_url: string;
  gallery_image_urls: string[];
  cancellation_policy: CancellationPolicy;
  cancellation_policy_text: string | null;
  no_show_fee_cents: number | null;
  status: ActivityStatus;
  /**
   * Admin-curated flag. True = include in the homepage "Atividades em
   * destaque" strip. Defaults to false in migration 00026 so new
   * instructor-created activities don't auto-promote — an admin opts
   * each one in from /admin/activities.
   */
  featured_on_home: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivitySession {
  id: string;
  activity_id: string;
  starts_at: string;
  ends_at: string;
  max_seats: number;
  seats_remaining: number;
  status: ActivityStatus;
  quorum_state: QuorumState;
  quorum_evaluated_at: string | null;
  instructor_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  activity_id: string;
  seats_booked: number;
  total_price_cents: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
  stripe_payment_id: string | null;
  no_show: boolean;
  no_show_fee_charged: boolean;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  activity_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface ReviewPhoto {
  id: string;
  review_id: string;
  image_url: string;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  activity_id: string;
  created_at: string;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  filters: {
    categoryIds?: string[];
    neighborhood?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  };
  last_matched_at: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  channel: NotificationChannel;
  read: boolean;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  in_app_enabled: boolean;
}

export interface Payout {
  id: string;
  instructor_id: string;
  amount_cents: number;
  commission_cents: number;
  stripe_transfer_id: string | null;
  status: PayoutStatus;
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface Tag {
  id: string;
  name: TranslatedField;
  slug: string;
}

export interface InstructorAvailability {
  id: string;
  instructor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}
