import "server-only";

import { createClient } from "@/shared/api/supabase/server";
import type { UserProfile } from "@/shared/types/database";

export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, email, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    profile ?? {
      id: user.id,
      email: user.email ?? null,
      display_name: user.email?.split("@")[0] ?? null,
      avatar_url: null,
    }
  );
}
