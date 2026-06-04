"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/shared/api/supabase/auth";
import { nextPosition, hasConflict } from "@/entities/card/model/move";
import {
  UNIQUE_VIOLATION,
  appendWithRetryReturning,
} from "@/shared/lib/append-position";

const createSchema = z.object({
  columnId: z.string().uuid(),
  title: z.string().trim().min(1, "제목을 입력하세요").max(200),
  boardId: z.string().uuid(),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  due_date: z.string().datetime().nullable().optional(),
  ai_category: z.string().nullable().optional(),
  github_url: z.string().url().nullable().optional(),
});

/**
 * createCard — position 은 컬럼 마지막 카드 다음 (명세 6.2).
 *
 * 두 사용자가 거의 동시에 같은 컬럼 끝에 카드를 만들면 동일 lastPos 를 읽어 같은
 * between(last,null) position 을 계산 → cards(column_id, position) unique 제약
 * (마이그레이션 0004)이 두 번째 insert 를 unique_violation(23505)으로 거부한다.
 * appendWithRetryReturning 으로 lastPos 재조회 + 재계산 재시도해 raw 에러 노출을
 * 막는다. 직접 테이블 insert 라 supabase error.code 의 SQLSTATE 표면화가 신뢰성
 * 있어(함수 내부 예외와 달리) code 비교로 충돌을 직접 감지한다.
 */
export async function createCard(input: {
  columnId: string;
  title: string;
  boardId: string;
}) {
  const { columnId, title, boardId } = createSchema.parse(input);
  const { supabase, user } = await requireUser();

  const { value: id } = await appendWithRetryReturning<string>(
    async () => {
      const { data: lastCard } = await supabase
        .from("cards")
        .select("position")
        .eq("column_id", columnId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      return lastCard?.position ?? null;
    },
    async (position) => {
      const { data, error } = await supabase
        .from("cards")
        .insert({ column_id: columnId, title, position, created_by: user.id })
        .select("id")
        .single();
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return { conflict: true };
        throw new Error(error.message);
      }
      return { conflict: false, value: data.id as string };
    },
  );

  revalidatePath(`/board/${boardId}`);
  return id;
}

export async function updateCard(
  id: string,
  patch: z.infer<typeof updateSchema>,
  boardId: string,
) {
  const parsed = updateSchema.parse(patch);
  const { supabase } = await requireUser();
  const { error } = await supabase.from("cards").update(parsed).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}

/**
 * moveCard — 드래그앤드롭 결과 반영 (명세 6.2 / 10.2).
 * before/after 카드 position 사이로 lexorank 재계산.
 * expectedUpdatedAt 불일치 시 충돌로 거부 → 클라이언트 낙관적 롤백.
 */
export async function moveCard(input: {
  id: string;
  columnId: string;
  beforePosition: string | null;
  afterPosition: string | null;
  expectedUpdatedAt: string | null;
  boardId: string;
}) {
  const { supabase } = await requireUser();

  const { data: current, error: readErr } = await supabase
    .from("cards")
    .select("updated_at")
    .eq("id", input.id)
    .single();
  if (readErr) throw new Error(readErr.message);

  if (hasConflict(input.expectedUpdatedAt, current.updated_at)) {
    throw new Error("CONFLICT: 다른 사용자가 먼저 이 카드를 수정했습니다");
  }

  const position = nextPosition(input.beforePosition, input.afterPosition);
  const { error } = await supabase
    .from("cards")
    .update({ column_id: input.columnId, position })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/board/${input.boardId}`);
  return position;
}

export async function deleteCard(id: string, boardId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}

export async function assignCard(
  cardId: string,
  userId: string,
  boardId: string,
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("card_assignees")
    .upsert(
      { card_id: cardId, user_id: userId },
      { onConflict: "card_id,user_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}

export async function unassignCard(
  cardId: string,
  userId: string,
  boardId: string,
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("card_assignees")
    .delete()
    .eq("card_id", cardId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}

export async function addComment(
  cardId: string,
  content: string,
  boardId: string,
) {
  const trimmed = z.string().trim().min(1).max(5000).parse(content);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("comments")
    .insert({ card_id: cardId, author_id: user.id, content: trimmed });
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}
