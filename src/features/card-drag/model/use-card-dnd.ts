"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DragEndEvent } from "@dnd-kit/core";
import { moveCard } from "@/entities/card/api/actions";
import { useBoardStore } from "@/entities/board/model/store";

/**
 * 명세 6.2 moveCard + 10.1 낙관적 UI + 10.2 충돌 롤백.
 * 드롭 시 즉시 로컬 반영 → 서버 반영. CONFLICT 면 스냅샷 복원 + 새로고침.
 */
export function useCardDnd(boardId: string) {
  const router = useRouter();

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const columns = useBoardStore.getState().columns;
    const activeId = String(active.id);

    let fromCol = columns.find((c) =>
      c.cards.some((card) => card.id === activeId),
    );
    if (!fromCol) return;
    const dragged = fromCol.cards.find((c) => c.id === activeId);
    if (!dragged) return;

    // over 는 카드(sortable) 또는 컬럼(droppable) id
    const overId = String(over.id);
    let toCol = columns.find((c) => c.id === overId);
    let toIndex: number;
    if (toCol) {
      toIndex = toCol.cards.length;
    } else {
      toCol = columns.find((c) => c.cards.some((cc) => cc.id === overId));
      if (!toCol) return;
      toIndex = toCol.cards.findIndex((cc) => cc.id === overId);
    }

    if (toCol.id === fromCol.id) {
      const currentIndex = fromCol.cards.findIndex((c) => c.id === activeId);
      if (currentIndex === toIndex) return;
    }

    const snapshot = useBoardStore
      .getState()
      .moveCardLocal(activeId, toCol.id, toIndex);

    // 이동 후 이웃 position 계산
    const updated = useBoardStore
      .getState()
      .columns.find((c) => c.id === toCol!.id)!;
    const pos = updated.cards.findIndex((c) => c.id === activeId);
    const before = pos > 0 ? updated.cards[pos - 1]!.position : null;
    const after =
      pos < updated.cards.length - 1
        ? updated.cards[pos + 1]!.position
        : null;

    try {
      await moveCard({
        id: activeId,
        columnId: toCol.id,
        beforePosition: before,
        afterPosition: after,
        expectedUpdatedAt: dragged.updated_at,
        boardId,
      });
    } catch (e) {
      useBoardStore.getState().restore(snapshot);
      const msg = e instanceof Error ? e.message : "이동 실패";
      if (msg.startsWith("CONFLICT")) {
        toast.error("충돌: 다른 사용자가 먼저 수정했습니다. 새로고침합니다.");
        router.refresh();
      } else {
        toast.error(msg);
      }
    }
  }

  return { onDragEnd };
}
