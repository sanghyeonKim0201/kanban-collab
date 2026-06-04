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

  // FR-25: 항목별 편집 상태(제목/담당자). 카드로 보내기 직전 값 그대로 사용.
  const [drafts, setDrafts] = useState<
    Record<string, { title: string; assignee: string }>
  >(() =>
    Object.fromEntries(
      items.map((it) => [
        it.id,
        { title: it.title, assignee: it.suggested_assignee ?? "" },
      ]),
    ),
  );

  function draftFor(item: MeetingActionItem) {
    return (
      drafts[item.id] ?? {
        title: item.title,
        assignee: item.suggested_assignee ?? "",
      }
    );
  }

  function patch(item: MeetingActionItem, field: "title" | "assignee", value: string) {
    setDrafts((d) => ({
      ...d,
      [item.id]: { ...draftFor(item), [field]: value },
    }));
  }

  function makeCard(item: MeetingActionItem) {
    if (!columnId) {
      toast.error("대상 컬럼이 없습니다. 먼저 보드를 만드세요.");
      return;
    }
    const draft = draftFor(item);
    const title = draft.title.trim();
    if (!title) {
      toast.error("제목을 입력하세요.");
      return;
    }
    start(async () => {
      try {
        await createCardFromActionItem({
          actionItemId: item.id,
          columnId,
          title,
          suggestedAssignee: draft.assignee.trim() || null,
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
      {flatColumns.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">대상 컬럼</span>
          <select
            value={columnId}
            onChange={(e) => setColumnId(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {flatColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((it) => {
          const draft = draftFor(it);
          const linked = Boolean(it.card_id);
          return (
            <li
              key={it.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm sm:flex-row sm:items-center"
            >
              {linked ? (
                <>
                  <span className="flex-1 text-foreground">{it.title}</span>
                  {it.suggested_assignee && (
                    <span className="text-xs text-muted-foreground">
                      @{it.suggested_assignee}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-success" /> 카드 연결됨
                  </span>
                </>
              ) : (
                <>
                  {/* FR-25: 보드 추가 전 인라인 제목 편집 */}
                  <input
                    aria-label="작업 제목"
                    value={draft.title}
                    disabled={pending}
                    onChange={(e) => patch(it, "title", e.target.value)}
                    className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {/* FR-25: 담당자 편집 */}
                  <input
                    aria-label="담당자"
                    placeholder="담당자"
                    value={draft.assignee}
                    disabled={pending}
                    onChange={(e) => patch(it, "assignee", e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-32"
                  />
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => makeCard(it)}
                  >
                    <Plus className="h-3.5 w-3.5" /> 카드로 보내기
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
