"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/shared/api/supabase/auth";
import type { Label } from "@/shared/types/database";

const nameSchema = z.string().trim().min(1, "레이블 이름을 입력하세요").max(40);
const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "색상 형식이 올바르지 않습니다");

/** 보드에 새 레이블 생성 */
export async function createLabel(
  boardId: string,
  name: string,
  color: string,
): Promise<Label> {
  const parsedName = nameSchema.parse(name);
  const parsedColor = colorSchema.parse(color);
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("labels")
    .insert({ board_id: boardId, name: parsedName, color: parsedColor })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
  return data as Label;
}

export async function deleteLabel(labelId: string, boardId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("labels").delete().eq("id", labelId);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}

/** 카드에 레이블 부착 */
export async function attachLabel(
  cardId: string,
  labelId: string,
  boardId: string,
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("card_labels")
    .upsert(
      { card_id: cardId, label_id: labelId },
      { onConflict: "card_id,label_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}

/** 카드에서 레이블 제거 */
export async function detachLabel(
  cardId: string,
  labelId: string,
  boardId: string,
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("card_labels")
    .delete()
    .eq("card_id", cardId)
    .eq("label_id", labelId);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}
