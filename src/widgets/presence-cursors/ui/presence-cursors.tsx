"use client";

import { MousePointer2 } from "lucide-react";
import type { Peer } from "@/shared/types/collaboration";

/** 명세 7.2-2: 다른 접속자 커서 즉시 표시 */
export function PresenceCursors({ peers }: { peers: Peer[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {peers
        .filter((p) => p.cursor)
        .map((p) => (
          <div
            key={p.userId}
            className="absolute flex items-center gap-1 transition-transform duration-75"
            style={{
              transform: `translate(${p.cursor!.x}px, ${p.cursor!.y}px)`,
            }}
          >
            <MousePointer2
              className="h-4 w-4"
              style={{ color: p.color, fill: p.color }}
            />
            <span
              className="rounded px-1 py-0.5 text-[10px] font-medium text-white"
              style={{ background: p.color }}
            >
              {p.name}
            </span>
          </div>
        ))}
    </div>
  );
}
