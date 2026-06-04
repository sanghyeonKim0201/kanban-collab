"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { createCard } from "@/entities/card/api/actions";
import { fromDateInputValue } from "@/entities/card/model/due-date";
import type { Priority } from "@/shared/types/database";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/cn";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

const fieldClass = cn(
  "h-9 w-full rounded-md border border-border bg-surface px-2.5 text-[13px] text-foreground",
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
);

export function AddCard({
  columnId,
  boardId,
}: {
  columnId: string;
  boardId: string;
}) {
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function reset() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setShowDetails(false);
    setOpen(false);
  }

  function submit() {
    const value = title.trim();
    if (!value) return;
    start(async () => {
      try {
        await createCard({
          columnId,
          title: value,
          boardId,
          // 상세 옵션을 펼쳐 채운 값만 전송 — 접힌 상태면 기존 빠른 추가와 동일.
          ...(showDetails && {
            description: description.trim() || null,
            priority,
            due_date: fromDateInputValue(dueDate),
          }),
        });
        reset();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "카드 생성 실패");
      }
    });
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" /> 카드 추가
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        autoFocus
        value={title}
        placeholder="카드 제목"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") reset();
        }}
      />

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {showDetails ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        상세 옵션
      </button>

      {showDetails && (
        <div className="space-y-2 rounded-md border border-border bg-surface p-2.5">
          <Textarea
            value={description}
            placeholder="설명 (선택)"
            rows={2}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              aria-label="우선순위"
              className={fieldClass}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="마감일"
              className={fieldClass}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !title.trim()}>
          {pending ? "추가 중…" : "추가"}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          취소
        </Button>
      </div>
    </div>
  );
}
