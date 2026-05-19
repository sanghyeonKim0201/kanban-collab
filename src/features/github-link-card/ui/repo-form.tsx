"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setBoardRepo } from "@/entities/board/api/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function RepoForm({
  boardId,
  boardName,
  current,
}: {
  boardId: string;
  boardName: string;
  current: string | null;
}) {
  const [repo, setRepo] = useState(current ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    start(async () => {
      try {
        await setBoardRepo(boardId, repo.trim());
        toast.success("저장됨");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "저장 실패");
      }
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-md border p-3">
      <span className="w-40 truncate text-sm font-medium">{boardName}</span>
      <Input
        value={repo}
        placeholder="owner/repo"
        onChange={(e) => setRepo(e.target.value)}
        className="flex-1"
      />
      <Button size="sm" onClick={save} disabled={pending}>
        {pending ? "저장 중…" : "연결"}
      </Button>
    </div>
  );
}
