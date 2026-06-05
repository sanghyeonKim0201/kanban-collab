"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { setPrAutomation } from "@/entities/board/api/actions";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

type Col = { id: string; name: string };

/**
 * radix Select 는 value="" 를 SelectItem 에 못 쓴다.
 * "없음"(컬럼 미지정) 은 NONE sentinel 로 표현하고, 저장 시 빈문자열/ null 로 환원한다.
 */
const NONE = "__none__";

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
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span>PR 열림 →</span>
          <Select
            value={openCol || NONE}
            onValueChange={(v) => setOpenCol(v === NONE ? "" : v)}
          >
            <SelectTrigger aria-label="PR 열림 시 이동할 컬럼" className="h-8 w-auto min-w-[7rem] bg-surface-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>없음</SelectItem>
              {columns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span>PR 머지 →</span>
          <Select
            value={mergedCol || NONE}
            onValueChange={(v) => setMergedCol(v === NONE ? "" : v)}
          >
            <SelectTrigger aria-label="PR 머지 시 이동할 컬럼" className="h-8 w-auto min-w-[7rem] bg-surface-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>없음</SelectItem>
              {columns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" onClick={save} disabled={saving} className="mt-3">저장</Button>
    </div>
  );
}
