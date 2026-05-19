"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createCard } from "@/entities/card/api/actions";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

export function AddCard({
  columnId,
  boardId,
}: {
  columnId: string;
  boardId: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    const value = title.trim();
    if (!value) return;
    start(async () => {
      try {
        await createCard({ columnId, title: value, boardId });
        setTitle("");
        setOpen(false);
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
        className="w-full justify-start text-muted-foreground"
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
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? "추가 중…" : "추가"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          취소
        </Button>
      </div>
    </div>
  );
}
