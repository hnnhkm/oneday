import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types/database";

export async function fetchCategories(): Promise<Category[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("slug", { ascending: true });

  if (error) return [];

  return (data as unknown as Category[]) || [];
}

/**
 * Homepage-specific subset: only categories the admin has flagged
 * `show_on_home=true`. Kept separate from `fetchCategories` because
 * the search bar, filters panel, and instructor activity form all
 * need the full taxonomy regardless of the home-page curation.
 */
export async function fetchHomeCategories(): Promise<Category[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("show_on_home", true)
    .order("slug", { ascending: true });

  if (error) return [];

  return (data as unknown as Category[]) || [];
}

export async function fetchCategoryBySlug(
  slug: string
): Promise<Category | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;

  return data as unknown as Category;
}
