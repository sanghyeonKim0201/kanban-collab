import "server-only";

import { createClient } from "@/shared/api/supabase/server";
import type { Comment, UserProfile } from "@/shared/types/database";

export interface CommentWithAuthor extends Comment {
  author: UserProfile | null;
}

export async function listComments(
  cardId: string,
): Promise<CommentWithAuthor[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const comments = (data ?? []) as Comment[];
  const authorIds = [...new Set(comments.map((c) => c.author_id))];

  const profiles = new Map<string, UserProfile>();
  if (authorIds.length) {
    const { data: people } = await supabase
      .from("user_profiles")
      .select("id, email, display_name, avatar_url")
      .in("id", authorIds);
    for (const p of (people ?? []) as UserProfile[]) profiles.set(p.id, p);
  }

  return comments.map((c) => ({
    ...c,
    author: profiles.get(c.author_id) ?? null,
  }));
}

export async function getCard(cardId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("cards")
    .select(
      "*, card_assignees(user_profiles(id, email, display_name, avatar_url))",
    )
    .eq("id", cardId)
    .maybeSingle();
  return data;
}
