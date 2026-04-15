import { notFound } from "next/navigation";
import { requireApprovedInstructor } from "@/lib/supabase/require-approved-instructor";
import { fetchMyActivityById } from "@/lib/queries/instructor";
import { fetchCategories } from "@/lib/queries/categories";
import { ActivityForm } from "@/components/instructor/activity-form";
import type { ActivityInput } from "@/lib/queries/activities";
import type { TranslatedField, CancellationPolicy } from "@/lib/types/database";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default async function EditActivityPage({ params }: Props) {
  const { id } = await params;
  const { profile } = await requireApprovedInstructor();

  const [activity, categories] = await Promise.all([
    fetchMyActivityById(id, profile.id),
    fetchCategories(),
  ]);

  if (!activity) notFound();

  const initial: ActivityInput = {
    title: activity.title as TranslatedField,
    description: activity.description as TranslatedField,
    category_id: activity.category_id,
    tags: activity.tags,
    price_cents: activity.price_cents,
    date: activity.date,
    time: (activity.time || "").slice(0, 5),
    duration_minutes: activity.duration_minutes,
    address: activity.address,
    neighborhood: activity.neighborhood,
    city: activity.city,
    state: activity.state,
    latitude: activity.latitude,
    longitude: activity.longitude,
    max_seats: activity.max_seats,
    min_participants: activity.min_participants,
    cover_image_url: activity.cover_image_url,
    gallery_image_urls: activity.gallery_image_urls,
    cancellation_policy: activity.cancellation_policy as CancellationPolicy,
    cancellation_policy_text: activity.cancellation_policy_text,
    no_show_fee_cents: activity.no_show_fee_cents,
  };

  return (
    <ActivityForm
      mode="edit"
      activityId={id}
      initial={initial}
      categories={categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        icon: c.icon,
      }))}
    />
  );
}
