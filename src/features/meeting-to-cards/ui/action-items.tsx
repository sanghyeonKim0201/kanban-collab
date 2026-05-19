"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { createCardFromActionItem } from "@/entities/meeting/api/actions";
import type { MeetingActionItem } from "@/shared/types/database";
import { Button } from "@/shared/ui/button";

interface Target {
  boardId: string;
  boardName: string;
  columns: { id: string; name: string }[];
}

export function ActionItems({
  meetingId,
  items,
  targets,
}: {
  meetingId: string;
  items: MeetingActionItem[];
  targets: Target[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const flatColumns = targets.flatMap((t) =>
    t.columns.map((c) => ({
      id: c.id,
      label: `${t.boardName} · ${c.name}`,
    })),
  );
  const [columnId, setColumnId] = useState(flatColumns[0]?.id ?? "");

  function makeCard(item: MeetingActionItem) {
    if (!columnId) {
      toast.error("대상 컬럼이 없습니다. 먼저 보드를 만드세요.");
      return;
    }
    start(async () => {
      try {
        await createCardFromActionItem({
          actionItemId: item.id,
          columnId,
          title: item.title,
          meetingId,
        });
        toast.success("카드 생성됨");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "카드 생성 실패");
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        추출된 작업이 없습니다. &quot;작업 추출&quot; 을 먼저 실행하세요.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">대상</span>
        <select
          value={columnId}
          onChange={(e) => setColumnId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {flatColumns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-2 rounded-md border p-2 text-sm"
          >
            <span className="flex-1">{it.title}</span>
            {it.suggested_assignee && (
              <span className="text-xs text-muted-foreground">
                @{it.suggested_assignee}
              </span>
            )}
            {it.card_id ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5" /> 카드 연결됨
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => makeCard(it)}
              >
                <Plus className="h-3.5 w-3.5" /> 카드로 만들기
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
