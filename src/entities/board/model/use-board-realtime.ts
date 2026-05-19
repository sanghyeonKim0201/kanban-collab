"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/api/supabase/client";
import { isSupabaseConfigured } from "@/shared/config/env";
import { useDebouncedCallback } from "@/shared/lib/use-debounce";

/**
 * 명세 6.3 board:{boardId} 채널 — Postgres CDC.
 * cards/columns 의 INSERT/UPDATE/DELETE 를 구독해 보드 상태를 자동 갱신.
 *
 * CDC 페이로드는 조인(assignees/labels)을 포함하지 않으므로, 정합성을 위해
 * 디바운스된 RSC 재요청으로 보드 데이터를 재동기화한다 (명세 10.1 디바운싱).
 * Supabase 미설정 시 no-op.
 */
export function useBoardRealtime(boardId: string) {
  const router = useRouter();
  const resync = useDebouncedCallback(() => router.refresh(), 250);

  useEffect(() => {
    if (!isSupabaseConfigured() || !boardId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards" },
        resync,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "columns" },
        resync,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, resync]);
}
