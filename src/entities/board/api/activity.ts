import "server-only";
import { createClient } from "@/shared/api/supabase/server";
import type { BoardActivity } from "@/shared/types/database";

type ServerClient = ReturnType<typeof createClient>;

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

/**
 * FR-09: 활동 이력 한 줄 기록(비치명).
 *
 * 카드 CRUD 등 본 동작이 이미 확정된 뒤 best-effort 로 호출한다. board_activity
 * INSERT 는 워크스페이스 멤버 RLS 정책(마이그레이션 0007)으로 허용되며, 실패해도
 * 본 액션을 막지 않도록 예외를 삼킨다(피드 한 줄이 빠질 뿐). kind 는 카드 변경
 * 통일값 'card_change' 를 기본으로 둔다 — use-board-activity 가 이 kind 로 토스트
 * 노출 여부를 분기한다.
 */
export async function logActivity(
  supabase: ServerClient,
  input: {
    boardId: string;
    cardId?: string | null;
    message: string;
    kind?: string;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("board_activity").insert({
      board_id: input.boardId,
      card_id: input.cardId ?? null,
      kind: input.kind ?? "card_change",
      message: input.message,
    });
    if (error) {
      // 비치명: 본 액션은 이미 성공. 피드 기록만 누락.
      console.error("[logActivity] insert 실패:", error.message);
    }
  } catch (e) {
    console.error("[logActivity] 예외:", e);
  }
}
