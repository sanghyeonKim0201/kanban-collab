"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { setPrAutomation } from "@/entities/board/api/actions";
import { Button } from "@/shared/ui/button";

type Col = { id: string; name: string };

/** 이름 휴리스틱으로 기본 매핑 추천(미설정 시). */
function suggest(cols: Col[], kind: "open" | "done"): string | null {
  const keys = kind === "open" ? ["진행", "progress", "doing"] : ["완료", "done", "complete"];
  const hit = cols.find((c) => keys.some((k) => c.name.toLowerCase().includes(k.toLowerCase())));
  return hit?.id ?? null;
}

export function PrAutomationSettings({
  boardId,
  canEdit,
  columns,
  initial,
}: {
  boardId: string;
  canEdit: boolean;
  columns: Col[];
  initial: { enabled: boolean; openColumnId: string | null; mergedColumnId: string | null };
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [openCol, setOpenCol] = useState(initial.openColumnId ?? suggest(columns, "open") ?? "");
  const [mergedCol, setMergedCol] = useState(initial.mergedColumnId ?? suggest(columns, "done") ?? "");
  const [saving, setSaving] = useState(false);

  if (!canEdit) return null;

  async function save() {
    setSaving(true);
    try {
      await setPrAutomation({
        boardId,
        enabled,
        openColumnId: openCol || null,
        mergedColumnId: mergedCol || null,
      });
      toast.success("PR 자동화 설정 저장됨");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">PR 자동화</span>
        <label className="flex items-center gap-1.5 text-[13px] text-foreground">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          사용
        </label>
      </div>
      <div className="space-y-2">
        <label className="block text-[12px] text-muted-foreground">
          PR 열림 →
          <select
            value={openCol}
            onChange={(e) => setOpenCol(e.target.value)}
            className="ml-2 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[13px] text-foreground"
          >
            <option value="">없음</option>
            {columns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </label>
        <label className="block text-[12px] text-muted-foreground">
          PR 머지 →
          <select
            value={mergedCol}
            onChange={(e) => setMergedCol(e.target.value)}
            className="ml-2 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[13px] text-foreground"
          >
            <option value="">없음</option>
            {columns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </label>
      </div>
      <Button size="sm" onClick={save} disabled={saving} className="mt-3">저장</Button>
    </div>
  );
}
