import "server-only";
import { createClient } from "@/shared/api/supabase/server";
import type { BoardActivity } from "@/shared/types/database";

export async function listBoardActivity(
  boardId: string,
  limit = 8,
): Promise<BoardActivity[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("board_activity")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
