"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createCard } from "@/entities/card/api/actions";
import type { MemberRow } from "@/entities/workspace/api/queries";
import type { Priority } from "@/shared/types/database";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

const PRIORITIES: Priority[] = ["low", "medium", "high"];
const PRIORITY_LABEL: Record<Priority, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

export function AddCard({
  columnId,
  boardId,
  members,
}: {
  columnId: string;
  boardId: string;
  members: MemberRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function reset() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setAssignees([]);
  }

  function toggleAssignee(id: string) {
    setAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function submit() {
    const value = title.trim();
    if (!value) {
      toast.error("제목을 입력하세요");
      return;
    }
    start(async () => {
      try {
        await createCard({
          columnId,
          boardId,
          title: value,
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          assigneeIds: assignees,
        });
        toast.success("카드 추가됨");
        reset();
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "카드 생성 실패");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
        >
          <Plus className="h-4 w-4" /> 카드 추가
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 카드</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="card-title">제목 *</Label>
            <Input
              id="card-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              placeholder="카드 제목"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="card-desc">설명</Label>
            <Textarea
              id="card-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="설명 (선택)"
            />
          </div>

          <div className="space-y-1.5">
            <Label>우선순위</Label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={priority === p ? "default" : "outline"}
                  onClick={() => setPriority(p)}
                >
                  {PRIORITY_LABEL[p]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="card-due">마감일</Label>
            <Input
              id="card-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {members.length > 0 && (
            <div className="space-y-1.5">
              <Label>담당자</Label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const active = assignees.includes(m.user.id);
                  return (
                    <button
                      key={m.user.id}
                      type="button"
                      onClick={() => toggleAssignee(m.user.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors",
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "hover:bg-accent",
                      )}
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className="text-[8px]">
                          {(m.user.display_name ?? m.user.email ?? "?")
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {m.user.display_name ?? m.user.email}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "추가 중…" : "카드 추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
