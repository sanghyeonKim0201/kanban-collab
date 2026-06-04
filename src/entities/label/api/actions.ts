"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/shared/api/supabase/auth";
import type { Label } from "@/shared/types/database";

const createSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().trim().min(1, "라벨 이름을 입력하세요").max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "색상은 #RRGGBB 형식이어야 합니다"),
});

/**
 * createLabel — 보드 라벨 생성 (명세 FR-07).
 * owner/admin/member 권한은 RLS "labels write" 정책이 처리.
 */
export async function createLabel(
  boardId: string,
  name: string,
  color: string,
): Promise<Label> {
  const parsed = createSchema.parse({ boardId, name, color });
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("labels")
    .insert({
      board_id: parsed.boardId,
      name: parsed.name,
      color: parsed.color,
    })
    .select("id, board_id, name, color")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
  return data as Label;
}

/** attachLabel — 카드에 라벨 부착. 중복(unique card_id,label_id)은 무시. */
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
      { onConflict: "card_id,label_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}

/** detachLabel — 카드에서 라벨 떼기. */
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
