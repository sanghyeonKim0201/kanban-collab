"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { renameBoard, deleteBoard } from "@/entities/board/api/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

/**
 * FR-01: 보드 이름 변경(인라인)·삭제(confirm) 진입점.
 * owner/admin(canEdit) 일 때만 board-toolbar 에 렌더된다.
 * 이름 변경은 column-header 와 동일한 멱등 가드(committedRef)로 Enter→unmount blur
 * 이중 commit 을 막는다.
 */
export function BoardMenu({
  boardId,
  workspaceId,
  name,
}: {
  boardId: string;
  workspaceId: string;
  name: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [pending, start] = useTransition();
  const committedRef = useRef(false);

  function startEditing() {
    setDraft(name);
    committedRef.current = false;
    setEditing(true);
  }

  function commit() {
    if (committedRef.current) return;
    committedRef.current = true;
    const value = draft.trim();
    setEditing(false);
    if (!value || value === name) {
      setDraft(name);
      return;
    }
    start(async () => {
      try {
        await renameBoard(boardId, value);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "이름 변경 실패");
        setDraft(name);
      }
    });
  }

  function remove() {
    if (
      !window.confirm(
        `보드 "${name}" 을(를) 삭제할까요? 컬럼과 카드가 모두 함께 삭제됩니다.`,
      )
    )
      return;
    start(async () => {
      try {
        await deleteBoard(boardId, workspaceId);
        router.push(`/workspaces/${workspaceId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            committedRef.current = true;
            setDraft(name);
            setEditing(false);
          }
        }}
        aria-label="보드 이름"
        className="min-w-0 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[15px] font-semibold text-foreground focus:border-primary/60 focus:outline-none"
      />
    );
  }

  // 이름(h1)을 메뉴와 한 컴포넌트에서 렌더해 editing 시 input 으로 통째로 교체 —
  // toolbar 의 별도 h1 과 이름이 중복되지 않도록 토글 책임을 여기로 모은다.
  return (
    <div className="group flex items-center gap-1">
      <h1
        onDoubleClick={startEditing}
        title="더블클릭하여 이름 변경"
        className="cursor-text text-[15px] font-semibold text-foreground"
      >
        {name}
      </h1>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-surface-2 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
          aria-label="보드 메뉴"
          disabled={pending}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={startEditing}>이름 변경</DropdownMenuItem>
          <DropdownMenuItem
            onClick={remove}
            className="text-destructive focus:text-destructive"
          >
            삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
