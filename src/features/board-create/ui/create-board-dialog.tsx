"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createBoard } from "@/entities/workspace/api/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

export function CreateBoardDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    start(async () => {
      try {
        const id = await createBoard(workspaceId, formData);
        toast.success("보드 생성됨");
        setOpen(false);
        router.push(`/board/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "생성 실패");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> 새 보드
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 보드</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="board-name">이름</Label>
            <Input id="board-name" name="name" autoFocus required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "생성 중…" : "생성"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
