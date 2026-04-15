import { createClient } from "@/lib/supabase/server";
import type { SavedSearch } from "@/lib/types/database";

export async function fetchUserSavedSearches(
  userId: string
): Promise<SavedSearch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as SavedSearch[];
}

export async function fetchSavedSearchCount(
  userId: string
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("saved_searches")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return count || 0;
}
