"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/shared/api/supabase/client";
import { isSupabaseConfigured } from "@/shared/config/env";
import type { BoardActivity } from "@/shared/types/database";

/**
 * board_activity INSERT 구독 → 피드 갱신 + 선택적 토스트.
 * 초기값(initial)은 RSC 주입, 신규 insert 는 앞에 prepend.
 *
 * 토스트 분기(FR-09): 카드 변경(kind='card_change')은 본인이 방금 일으킨
 * 흔한 동작이라 토스트 없이 피드에만 남긴다. PR/이슈 자동화 등 그 외 kind 는
 * 외부 트리거 알림이므로 토스트로 띄운다.
 */
export function useBoardActivity(boardId: string, initial: BoardActivity[]) {
  const [items, setItems] = useState<BoardActivity[]>(initial);

  useEffect(() => {
    if (!isSupabaseConfigured() || !boardId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`board-activity:${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "board_activity",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const row = payload.new as BoardActivity;
          setItems((prev) => [row, ...prev].slice(0, 8));
          if (row.kind !== "card_change") toast(row.message);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  return items;
}
