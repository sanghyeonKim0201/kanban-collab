"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Github, Plus, X } from "lucide-react";
import { ClassifyPanel } from "@/features/ai-classify-card/ui/classify-panel";
import {
  addComment,
  assignCard,
  deleteComment,
  unassignCard,
  updateCard,
  updateComment,
} from "@/entities/card/api/actions";
import {
  attachLabel,
  createLabel,
  detachLabel,
} from "@/entities/label/api/actions";
import type { CardDetail } from "@/entities/card/api/detail";
import {
  toDateInputValue,
  fromDateInputValue,
} from "@/entities/card/model/due-date";
import type { Priority } from "@/shared/types/database";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib/cn";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { PrStatusBadge } from "@/features/pr-automation/ui/pr-status-badge";
import { CardGithubUrlInput } from "@/features/pr-automation/ui/card-github-url-input";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

const DEFAULT_LABEL_COLOR = "#6366f1";

export function CardDetailPanel({ detail }: { detail: CardDetail }) {
  const router = useRouter();
  const {
    card,
    boardId,
    members,
    assignees,
    comments,
    currentUserId,
    labels,
    boardLabels,
  } = detail;
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [dueDate, setDueDate] = useState(toDateInputValue(card.due_date));
  const [comment, setComment] = useState("");
  const [tab, setTab] = useState("overview");
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(DEFAULT_LABEL_COLOR);
  const assignedIds = new Set(assignees.map((a) => a.id));
  const attachedLabelIds = new Set(labels.map((l) => l.id));
  const unattachedLabels = boardLabels.filter(
    (l) => !attachedLabelIds.has(l.id),
  );

  function save() {
    start(async () => {
      try {
        await updateCard(
          card.id,
          {
            title: title.trim(),
            description: description.trim() || null,
            priority,
            due_date: fromDateInputValue(dueDate),
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

  function startEdit(id: string, content: string) {
    setEditingId(id);
    setEditingValue(content);
  }

  function saveEdit() {
    if (!editingId) return;
    const value = editingValue.trim();
    if (!value) return;
    const id = editingId;
    start(async () => {
      try {
        await updateComment(id, value, boardId);
        setEditingId(null);
        setEditingValue("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "댓글 수정 실패");
      }
    });
  }

  function removeComment(id: string) {
    if (!window.confirm("이 댓글을 삭제할까요?")) return;
    start(async () => {
      try {
        await deleteComment(id, boardId);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "댓글 삭제 실패");
      }
    });
  }

  function toggleLabel(labelId: string, attached: boolean) {
    start(async () => {
      try {
        if (attached) {
          await detachLabel(card.id, labelId, boardId);
        } else {
          await attachLabel(card.id, labelId, boardId);
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "라벨 변경 실패");
      }
    });
  }

  function submitNewLabel() {
    const name = newLabelName.trim();
    if (!name) return;
    start(async () => {
      try {
        const label = await createLabel(boardId, name, newLabelColor);
        await attachLabel(card.id, label.id, boardId);
        setNewLabelName("");
        setNewLabelColor(DEFAULT_LABEL_COLOR);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "라벨 생성 실패");
      }
    });
  }

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );

  return (
    <div className="space-y-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="카드 제목"
        placeholder="카드 제목"
        className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-base font-semibold text-foreground transition-colors hover:border-border-strong focus:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="activity">활동 ({comments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5 pt-4">
          <div>
            <SectionLabel>설명</SectionLabel>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="설명을 입력하세요"
            />
          </div>

          <div className="border-t border-border pt-4">
            <SectionLabel>우선순위</SectionLabel>
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

          <div className="border-t border-border pt-4">
            <SectionLabel>마감일</SectionLabel>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="마감일"
                className="h-9 rounded-md border border-border bg-surface px-2.5 text-[13px] text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              />
              {dueDate && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDueDate("")}
                >
                  지우기
                </Button>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <SectionLabel>담당자</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const active = assignedIds.has(m.user.id);
                return (
                  <button
                    key={m.user.id}
                    type="button"
                    onClick={() => toggleAssignee(m.user.id)}
                    disabled={pending}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors",
                      active
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground",
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

          <div className="border-t border-border pt-4">
            <SectionLabel>레이블</SectionLabel>
            {labels.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {labels.map((l) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 py-0.5 pl-2 pr-1 text-xs text-foreground"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: l.color }}
                    />
                    {l.name}
                    <button
                      type="button"
                      onClick={() => toggleLabel(l.id, true)}
                      disabled={pending}
                      aria-label={`${l.name} 라벨 떼기`}
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-2 text-xs text-muted-foreground">
                붙은 라벨이 없습니다.
              </p>
            )}

            {unattachedLabels.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {unattachedLabels.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLabel(l.id, false)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: l.color }}
                    />
                    {l.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={newLabelColor}
                onChange={(e) => setNewLabelColor(e.target.value)}
                aria-label="새 라벨 색상"
                className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-border bg-surface p-0.5"
              />
              <Input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="새 라벨 이름"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitNewLabel();
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={submitNewLabel}
                disabled={pending || !newLabelName.trim()}
              >
                <Plus className="h-4 w-4" /> 추가
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <ClassifyPanel
              cardId={card.id}
              boardId={boardId}
              currentCategory={card.ai_category}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Github className="h-3.5 w-3.5" /> GitHub
              <PrStatusBadge state={card.github_pr_state} />
            </p>
            <p className="break-all">
              {card.github_url ? (
                <a
                  href={card.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {card.github_url}
                </a>
              ) : (
                "보드 설정에서 저장소 연결 시 PR/Issue 자동 링크 (M3)"
              )}
            </p>
            <CardGithubUrlInput
              cardId={card.id}
              boardId={boardId}
              initialUrl={card.github_url}
            />
          </div>

          {/* 스크롤 영역 하단 고정 저장 바 */}
          <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-border bg-surface px-5 py-3">
            <Button onClick={save} disabled={pending} className="w-full">
              {pending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-3 pt-4">
          {comments.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
            </p>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => {
                const isOwn =
                  !!currentUserId && c.author_id === currentUserId;
                const isEditing = editingId === c.id;
                return (
                  <div
                    key={c.id}
                    className="rounded-lg border border-border bg-surface p-2.5 text-[13px]"
                  >
                    <div className="mb-0.5 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {c.author?.display_name ?? c.author?.email ?? "익명"}
                      </p>
                      {isOwn && !isEditing && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(c.id, c.content)}
                            disabled={pending}
                            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => removeComment(c.id)}
                            disabled={pending}
                            className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          rows={3}
                          aria-label="댓글 수정"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={saveEdit}
                            disabled={pending || !editingValue.trim()}
                          >
                            저장
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            disabled={pending}
                          >
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{c.content}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-2 border-t border-border bg-surface px-5 py-3">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
