import { createClient } from "@/lib/supabase/server";
import type { User } from "@/lib/types/database";

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  return profile as User | null;
}
