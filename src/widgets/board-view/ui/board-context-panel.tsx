"use client";
import { useBoardStore } from "@/entities/board/model/store";
import { computeBoardProgress, statusCounts } from "@/entities/board/model/stats";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { StatCard } from "@/shared/ui/stat-card";

export function BoardContextPanel() {
  const columns = useBoardStore((s) => s.columns);
  const progress = computeBoardProgress(columns);
  const counts = statusCounts(columns);
  const total = counts.reduce((n, c) => n + c.count, 0);
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>진행률</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <ProgressBar value={progress} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="전체 카드" value={total} />
        <StatCard label="컬럼" value={counts.length} />
      </div>
      <div className="space-y-1">
        {counts.map((c) => (
          <div
            key={c.name}
            className="flex items-center justify-between rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-2"
          >
            <span>{c.name}</span>
            <span className="tabular-nums">{c.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
