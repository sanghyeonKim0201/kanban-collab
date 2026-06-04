"use client";
import { useBoardStore } from "@/entities/board/model/store";
import { computeBoardProgress, statusCounts } from "@/entities/board/model/stats";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { PrAutomationSettings } from "@/features/pr-automation/ui/pr-automation-settings";
import { useBoardActivity } from "@/features/pr-automation/model/use-board-activity";
import type { BoardActivity } from "@/shared/types/database";

export function BoardContextPanel({
  boardId,
  canManageStructure,
  prAutomation,
  initialActivity,
}: {
  boardId: string;
  canManageStructure: boolean;
  prAutomation: { enabled: boolean; openColumnId: string | null; mergedColumnId: string | null };
  initialActivity: BoardActivity[];
}) {
  const activity = useBoardActivity(boardId, initialActivity);
  const columns = useBoardStore((s) => s.columns);
  const progress = computeBoardProgress(columns);
  const counts = statusCounts(columns);
  const total = counts.reduce((n, c) => n + c.count, 0);
  const done = columns.length ? (columns[columns.length - 1]?.cards.length ?? 0) : 0;

  return (
    <div className="space-y-4 p-4">
      {/* 개요 카드: 진행률 + 핵심 수치를 한 묶음으로 */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs font-medium text-muted-foreground">진행률</span>
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {progress}%
          </span>
        </div>
        <ProgressBar value={progress} />
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-center">
          <div className="bg-surface py-2">
            <div className="text-base font-semibold tabular-nums text-foreground">
              {total}
            </div>
            <div className="text-[11px] text-muted-foreground">전체 카드</div>
          </div>
          <div className="bg-surface py-2">
            <div className="text-base font-semibold tabular-nums text-foreground">
              {done}
            </div>
            <div className="text-[11px] text-muted-foreground">완료</div>
          </div>
        </div>
      </div>

      {/* 상태별 분포 */}
      <div>
        <div className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          상태별
        </div>
        <div className="space-y-0.5">
          {counts.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-surface-2"
            >
              <span className="truncate text-foreground">{c.name}</span>
              <span className="tabular-nums">{c.count}</span>
            </div>
          ))}
        </div>
      </div>

      <PrAutomationSettings
        boardId={boardId}
        canEdit={canManageStructure}
        columns={columns.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          enabled: prAutomation.enabled,
          openColumnId: prAutomation.openColumnId,
          mergedColumnId: prAutomation.mergedColumnId,
        }}
      />

      {activity.length > 0 && (
        <div>
          <div className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            활동
          </div>
          <div className="space-y-1">
            {activity.map((a) => (
              <div key={a.id} className="rounded-md px-2 py-1.5 text-[12px] text-muted-foreground">
                {a.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
