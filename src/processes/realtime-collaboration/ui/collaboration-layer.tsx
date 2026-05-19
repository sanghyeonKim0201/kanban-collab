"use client";

import { useEffect, useRef } from "react";
import { PresenceCursors } from "@/widgets/presence-cursors/ui/presence-cursors";
import { useCollaboration } from "../model/use-collaboration";

/**
 * 보드 실시간 협업 세션 조립 (명세 4.1 processes = 복합 시나리오).
 * Presence 접속자 + Broadcast 커서를 묶어 커서 레이어를 렌더.
 */
export function CollaborationLayer({
  boardId,
  userId,
  name,
}: {
  boardId: string;
  userId: string;
  name: string;
}) {
  const { peers, sendCursor } = useCollaboration(boardId, { userId, name });
  const raf = useRef<number | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        sendCursor(e.clientX, e.clientY);
      });
    }
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [sendCursor]);

  return <PresenceCursors peers={peers} />;
}
