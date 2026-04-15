import { requireApprovedInstructor } from "@/lib/supabase/require-approved-instructor";
import { fetchCategories } from "@/lib/queries/categories";
import { ActivityForm } from "@/components/instructor/activity-form";

export default async function NewActivityPage() {
  await requireApprovedInstructor();
  const categories = await fetchCategories();
  return (
    <ActivityForm
      mode="new"
      categories={categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        icon: c.icon,
      }))}
    />
  );
}
