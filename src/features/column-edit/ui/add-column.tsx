"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useColumnActions } from "../model/use-column-actions";

export function AddColumn({
  boardId,
  lastPosition,
}: {
  boardId: string;
  lastPosition: string | null;
}) {
  const { add, pending } = useColumnActions(boardId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function submit() {
    const value = name.trim();
    if (!value) return;
    add(value, lastPosition);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-[280px] shrink-0 items-center gap-2 rounded-xl border border-dashed border-border px-3 text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
      >
        <Plus className="h-4 w-4" /> 컬럼 추가
      </button>
    );
  }

  return (
    <div className="w-[280px] shrink-0 rounded-xl border border-border bg-surface/60 p-2">
      <Input
        autoFocus
        value={name}
        placeholder="컬럼 이름"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending}>
          추가
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          취소
        </Button>
      </div>
    </div>
  );
}
