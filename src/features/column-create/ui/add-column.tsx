"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createColumn } from "@/entities/column/api/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function AddColumn({
  boardId,
  afterPosition,
}: {
  boardId: string;
  afterPosition: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  function close() {
    setOpen(false);
    setName("");
  }

  function submit() {
    const value = name.trim();
    if (!value) return;
    start(async () => {
      try {
        await createColumn(boardId, value, afterPosition);
        close();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "컬럼 추가 실패");
      }
    });
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-auto w-80 shrink-0 justify-start rounded-xl border border-dashed border-border py-3 text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" /> 새 컬럼
      </Button>
    );
  }

  return (
    <div className="w-80 shrink-0 space-y-2 rounded-xl border border-border bg-muted/60 p-2">
      <Input
        autoFocus
        value={name}
        placeholder="컬럼 이름"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") close();
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? "추가 중…" : "추가"}
        </Button>
        <Button size="sm" variant="ghost" onClick={close}>
          취소
        </Button>
      </div>
    </div>
  );
}
