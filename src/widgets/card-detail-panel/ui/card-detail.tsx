"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Github, Trash2, X } from "lucide-react";
import { ClassifyPanel } from "@/features/ai-classify-card/ui/classify-panel";
import { LabelEditor } from "@/features/card-label/ui/label-editor";
import {
  addComment,
  assignCard,
  deleteCard,
  deleteComment,
  unassignCard,
  updateCard,
} from "@/entities/card/api/actions";
import type { CardDetail } from "@/entities/card/api/detail";
import type { Priority } from "@/shared/types/database";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

export function CardDetailPanel({ detail }: { detail: CardDetail }) {
  const router = useRouter();
  const { card, boardId, members, assignees, comments, currentUserId, labels, boardLabels } =
    detail;
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [dueDate, setDueDate] = useState(card.due_date?.slice(0, 10) ?? "");
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const assignedIds = new Set(assignees.map((a) => a.id));

  function save() {
    start(async () => {
      try {
        await updateCard(
          card.id,
          {
            title: title.trim(),
            description: description.trim() || null,
            priority,
            due_date: dueDate ? new Date(dueDate).toISOString() : null,
          },
          boardId,
        );
        toast.success("저장됨");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "저장 실패");
      }
    });
  }

  function removeCard() {
    if (!window.confirm("이 카드를 삭제할까요? 되돌릴 수 없습니다.")) return;
    start(async () => {
      try {
        await deleteCard(card.id, boardId);
        toast.success("카드 삭제됨");
        router.push(`/board/${boardId}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "카드 삭제 실패");
      }
    });
  }

  function removeComment(id: string) {
    start(async () => {
      try {
        await deleteComment(id, boardId);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "댓글 삭제 실패");
      }
    });
  }

  function toggleAssignee(userId: string) {
    start(async () => {
      try {
        if (assignedIds.has(userId)) {
          await unassignCard(card.id, userId, boardId);
        } else {
          await assignCard(card.id, userId, boardId);
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "담당자 변경 실패");
      }
    });
  }

  function submitComment() {
    const value = comment.trim();
    if (!value) return;
    start(async () => {
      try {
        await addComment(card.id, value, boardId);
        setComment("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "댓글 실패");
      }
    });
  }

  return (
    <div className="space-y-5">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-base font-semibold"
      />

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">설명</p>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="설명을 입력하세요"
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          우선순위
        </p>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={priority === p ? "default" : "outline"}
              onClick={() => setPriority(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">마감일</p>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-auto"
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">담당자</p>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const active = assignedIds.has(m.user.id);
            return (
              <button
                key={m.user.id}
                type="button"
                onClick={() => toggleAssignee(m.user.id)}
                disabled={pending}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
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

      <LabelEditor
        cardId={card.id}
        boardId={boardId}
        attached={labels}
        boardLabels={boardLabels}
      />

      <ClassifyPanel
        cardId={card.id}
        boardId={boardId}
        currentCategory={card.ai_category}
      />

      {/* M3 GitHub 링크 연결점 */}
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium">
          <Github className="h-3.5 w-3.5" /> GitHub
        </p>
        <p className="mt-1">
          {card.github_url
            ? card.github_url
            : "보드 설정에서 저장소 연결 시 PR/Issue 자동 링크 (M3)"}
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={pending} className="flex-1">
          {pending ? "저장 중…" : "저장"}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={removeCard}
          disabled={pending}
          aria-label="카드 삭제"
          title="카드 삭제"
          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">댓글 ({comments.length})</p>
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="group rounded-md border p-2 text-sm">
              <div className="mb-0.5 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {c.author?.display_name ?? c.author?.email ?? "익명"}
                </p>
                {c.author_id === currentUserId && (
                  <button
                    type="button"
                    onClick={() => removeComment(c.id)}
                    disabled={pending}
                    aria-label="댓글 삭제"
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {c.content}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="댓글 입력"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitComment();
              }
            }}
          />
          <Button onClick={submitComment} disabled={pending}>
            작성
          </Button>
        </div>
      </div>
    </div>
  );
}
