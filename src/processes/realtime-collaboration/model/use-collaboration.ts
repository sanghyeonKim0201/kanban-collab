"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/shared/api/supabase/client";
import { isSupabaseConfigured } from "@/shared/config/env";
import { peerColor } from "@/shared/lib/peer-color";
import type { Peer } from "@/shared/types/collaboration";

export type { Peer };

interface Me {
  userId: string;
  name: string;
}

/**
 * 명세 3.3 / 6.3:
 *  - Presence 채널: 접속자 식별 + viewingCardId
 *  - Broadcast 채널: 커서 좌표(고빈도, DB 미저장), 임시 드래그/타이핑
 * Supabase 미설정 시 no-op (peers 빈 배열).
 */
export function useCollaboration(boardId: string, me: Me | null) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const broadcastRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || !boardId || !me) return;
    const supabase = createClient();
    const color = peerColor(me.userId);

    const presence = supabase.channel(`board:${boardId}:presence`, {
      config: { presence: { key: me.userId } },
    });

    const cursors = new Map<string, Peer["cursor"]>();

    function rebuild() {
      const state = presence.presenceState<{
        userId: string;
        name: string;
        color: string;
        viewingCardId: string | null;
      }>();
      const list: Peer[] = [];
      for (const key of Object.keys(state)) {
        const meta = state[key]?.[0];
        if (!meta || meta.userId === me!.userId) continue;
        list.push({
          userId: meta.userId,
          name: meta.name,
          color: meta.color,
          viewingCardId: meta.viewingCardId,
          cursor: cursors.get(meta.userId) ?? null,
        });
      }
      setPeers(list);
    }

    presence
      .on("presence", { event: "sync" }, rebuild)
      .on("presence", { event: "join" }, rebuild)
      .on("presence", { event: "leave" }, rebuild)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presence.track({
            userId: me.userId,
            name: me.name,
            color,
            viewingCardId: null,
          });
        }
      });

    const broadcast = supabase
      .channel(`board:${boardId}:broadcast`)
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const p = payload as { userId: string; x: number; y: number };
        if (p.userId === me.userId) return;
        cursors.set(p.userId, { x: p.x, y: p.y });
        rebuild();
      })
      .subscribe();
    broadcastRef.current = broadcast;

    return () => {
      supabase.removeChannel(presence);
      supabase.removeChannel(broadcast);
      broadcastRef.current = null;
    };
  }, [boardId, me]);

  /** 커서 좌표 송신 (Broadcast — DB 미저장, 명세 3.3 중요 박스) */
  function sendCursor(x: number, y: number) {
    if (!me) return;
    broadcastRef.current?.send({
      type: "broadcast",
      event: "cursor",
      payload: { userId: me.userId, x, y },
    });
  }

  return { peers, sendCursor };
}
