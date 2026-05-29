import "server-only";

import { createClient } from "@/shared/api/supabase/server";
import type { Label } from "@/shared/types/database";

/** 보드의 전체 레이블 목록 */
export async function listLabels(boardId: string): Promise<Label[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("labels")
    .select("*")
    .eq("board_id", boardId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Label[];
}
