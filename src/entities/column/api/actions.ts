"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/shared/api/supabase/auth";
import { between } from "@/shared/lib/lexorank";

const nameSchema = z.string().trim().min(1).max(80);

export async function createColumn(
  boardId: string,
  name: string,
  afterPosition: string | null,
) {
  const parsed = nameSchema.parse(name);
  const { supabase } = await requireUser();
  const position = between(afterPosition, null);
  const { error } = await supabase
    .from("columns")
    .insert({ board_id: boardId, name: parsed, position });
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}

export async function renameColumn(
  id: string,
  name: string,
  boardId: string,
) {
  const parsed = nameSchema.parse(name);
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("columns")
    .update({ name: parsed })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}

export async function reorderColumn(input: {
  id: string;
  beforePosition: string | null;
  afterPosition: string | null;
  boardId: string;
}) {
  const { supabase } = await requireUser();
  const position = between(input.beforePosition, input.afterPosition);
  const { error } = await supabase
    .from("columns")
    .update({ position })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${input.boardId}`);
  return position;
}

export async function deleteColumn(id: string, boardId: string) {
  const { supabase } = await requireUser();
  // 카드가 남아있는 컬럼은 삭제 거부 (cascade 데이터 손실 방지).
  const { count } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("column_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(
      "카드가 있는 컬럼은 삭제할 수 없습니다. 먼저 카드를 옮기거나 삭제하세요.",
    );
  }
  const { error } = await supabase.from("columns").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}
