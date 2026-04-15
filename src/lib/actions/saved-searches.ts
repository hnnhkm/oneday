"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  validateSavedSearchInput,
  type SavedSearchFilters,
} from "@/lib/saved-search-validation";
import type { ActionResult } from "@/lib/actions/account";

const MAX_SAVED_SEARCHES = 10;

export async function createSavedSearchAction(
  name: string,
  filters: SavedSearchFilters
): Promise<ActionResult & { savedSearchId?: string }> {
  const validation = validateSavedSearchInput({ name, filters });
  if (validation) {
    return { ok: false, error: validation.message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Enforce per-user limit.
  const { count } = await supabase
    .from("saved_searches")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count || 0) >= MAX_SAVED_SEARCHES) {
    return {
      ok: false,
      error: `Maximum of ${MAX_SAVED_SEARCHES} saved searches reached`,
    };
  }

  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      user_id: user.id,
      name: name.trim(),
      filters,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A saved search with this name already exists" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings/saved-searches");
  return { ok: true, savedSearchId: (data as { id: string }).id };
}

export async function deleteSavedSearchAction(
  id: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/saved-searches");
  return { ok: true };
}
