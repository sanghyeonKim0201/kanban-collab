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
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/40">
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-sm font-semibold">{column.name}</h3>
        <span className="text-xs text-muted-foreground">
          {column.cards.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 px-2 pb-2 transition-colors ${
          isOver ? "bg-accent/40" : ""
        }`}
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
