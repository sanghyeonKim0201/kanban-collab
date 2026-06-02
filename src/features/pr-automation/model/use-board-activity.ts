"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/shared/api/supabase/client";
import { isSupabaseConfigured } from "@/shared/config/env";
import type { BoardActivity } from "@/shared/types/database";

/**
 * board_activity INSERT 구독 → 토스트 + 최근 목록 갱신.
 * 초기값(initial)은 RSC 주입, 신규 insert 는 앞에 prepend.
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
          toast(row.message);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  return items;
}
