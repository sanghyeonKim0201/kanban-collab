"use client";

import { type ReactNode, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useColumnActions } from "../model/use-column-actions";

export function ColumnHeader({
  columnId,
  name,
  count,
  boardId,
  canEdit,
  dragHandle,
}: {
  columnId: string;
  name: string;
  count: number;
  boardId: string;
  canEdit: boolean;
  dragHandle?: ReactNode;
}) {
  const { rename, remove } = useColumnActions(boardId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  function commit() {
    const value = draft.trim();
    setEditing(false);
    if (value && value !== name) rename(columnId, value);
    else setDraft(name);
  }

  if (!canEdit) {
    return (
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-[13px] font-semibold text-foreground">{name}</h3>
        <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1 px-2 py-2">
      {dragHandle && (
        <span className="cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
          {dragHandle}
        </span>
      )}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[13px] font-semibold text-foreground focus:border-primary/60 focus:outline-none"
        />
      ) : (
        <h3
          onDoubleClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          className="flex-1 cursor-text truncate text-[13px] font-semibold text-foreground"
          title="더블클릭하여 이름 변경"
        >
          {name}
        </h3>
      )}
      <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
        {count}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-surface-2 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="컬럼 메뉴"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
          >
            이름 변경
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={count > 0}
            onClick={() => remove(columnId)}
            className={cn(count === 0 && "text-destructive focus:text-destructive")}
          >
            {count > 0 ? "삭제 (카드 비우기 먼저)" : "삭제"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
