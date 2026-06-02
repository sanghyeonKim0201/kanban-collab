"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Github } from "lucide-react";
import { ClassifyPanel } from "@/features/ai-classify-card/ui/classify-panel";
import {
  addComment,
  assignCard,
  unassignCard,
  updateCard,
} from "@/entities/card/api/actions";
import type { CardDetail } from "@/entities/card/api/detail";
import type { Priority } from "@/shared/types/database";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib/cn";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

export function CardDetailPanel({ detail }: { detail: CardDetail }) {
  const router = useRouter();
  const { card, boardId, members, assignees, comments } = detail;
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [comment, setComment] = useState("");
  const [tab, setTab] = useState("overview");
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
            <ClassifyPanel
              cardId={card.id}
              boardId={boardId}
              currentCategory={card.ai_category}
            />
          </div>

          <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Github className="h-3.5 w-3.5" /> GitHub
            </p>
            <p className="mt-1 break-all">
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
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-border bg-surface p-2.5 text-[13px]"
                >
                  <p className="mb-0.5 text-xs text-muted-foreground">
                    {c.author?.display_name ?? c.author?.email ?? "익명"}
                  </p>
                  {c.content}
                </div>
              ))}
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
