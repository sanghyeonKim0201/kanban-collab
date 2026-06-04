import "server-only";

import { createClient } from "@/shared/api/supabase/server";
import type { Label } from "@/shared/types/database";

/** listBoardLabels — 보드에 정의된 라벨 목록 (명세 FR-07). */
export async function listBoardLabels(boardId: string): Promise<Label[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("labels")
    .select("id, board_id, name, color")
    .eq("board_id", boardId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Label[];
}
