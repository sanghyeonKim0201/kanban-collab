"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { renameColumn, deleteColumn } from "@/entities/column/api/actions";
import { AddCard } from "@/features/card-create/ui/add-card";
import { Input } from "@/shared/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { CardItem } from "./card-item";
import type { MemberRow } from "@/entities/workspace/api/queries";
import type { ColumnWithCards } from "@/shared/types/database";

export function BoardColumn({
  column,
  boardId,
  members,
}: {
  column: ColumnWithCards;
  boardId: string;
  members: MemberRow[];
}) {
  const router = useRouter();
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const [pending, start] = useTransition();

  function saveRename() {
    const value = name.trim();
    if (!value || value === column.name) {
      setEditing(false);
      setName(column.name);
      return;
    }
    start(async () => {
      try {
        await renameColumn(column.id, value, boardId);
        setEditing(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "이름 변경 실패");
        setName(column.name);
        setEditing(false);
      }
    });
  }

  function remove() {
    if (
      !window.confirm(
        `'${column.name}' 컬럼과 그 안의 카드가 모두 삭제됩니다. 계속할까요?`,
      )
    )
      return;
    start(async () => {
      try {
        await deleteColumn(column.id, boardId);
        toast.success("컬럼 삭제됨");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "컬럼 삭제 실패");
      }
    });
  }

  return (
    <div className="flex max-h-full w-80 shrink-0 flex-col rounded-xl border border-border bg-muted/60 shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3.5 py-3">
        {editing ? (
          <Input
            autoFocus
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") {
                setName(column.name);
                setEditing(false);
              }
            }}
            className="h-7 py-0"
          />
        ) : (
          <h3 className="truncate text-sm font-semibold tracking-tight">
            {column.name}
          </h3>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <span className="min-w-6 rounded-full bg-background px-2 py-0.5 text-center text-xs font-medium tabular-nums text-muted-foreground">
            {column.cards.length}
          </span>
          {!editing && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label="컬럼 메뉴"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> 이름 변경
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={remove}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> 컬럼 삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto rounded-lg px-2.5 transition-colors",
          isOver && "bg-accent ring-2 ring-inset ring-primary/30",
        )}
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <CardItem key={card.id} card={card} boardId={boardId} />
          ))}
        </SortableContext>
        {column.cards.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground">
            카드를 여기로 옮기세요
          </div>
        )}
      </div>
      <div className="shrink-0 p-2">
        <AddCard columnId={column.id} boardId={boardId} members={members} />
      </div>
    </div>
  );
}
