"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AddCard } from "@/features/card-create/ui/add-card";
import { CardItem } from "./card-item";
import type { ColumnWithCards } from "@/shared/types/database";

export function BoardColumn({
  column,
  boardId,
}: {
  column: ColumnWithCards;
  boardId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  return (
    <div className="flex max-h-full w-[280px] shrink-0 flex-col rounded-xl border border-border bg-surface/60">
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-[13px] font-semibold text-foreground">{column.name}</h3>
        <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
          {column.cards.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[60px] space-y-2 overflow-y-auto px-2 pb-2 transition-shadow ${isOver ? "rounded-lg ring-2 ring-primary/40" : ""}`}
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <CardItem key={card.id} card={card} boardId={boardId} />
          ))}
        </SortableContext>
      </div>
      <div className="p-2">
        <AddCard columnId={column.id} boardId={boardId} />
      </div>
    </div>
  );
}
