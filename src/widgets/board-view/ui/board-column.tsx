"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { AddCard } from "@/features/card-create/ui/add-card";
import { ColumnHeader } from "@/features/column-edit/ui/column-header";
import { CardItem } from "./card-item";
import type { ColumnWithCards } from "@/shared/types/database";

export function BoardColumn({
  column,
  boardId,
  canManageStructure,
  canEditCards,
}: {
  column: ColumnWithCards;
  boardId: string;
  canManageStructure: boolean;
  canEditCards: boolean;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const {
    setNodeRef: setSortRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `colsort-${column.id}`,
    data: { type: "column-sort", columnId: column.id },
    disabled: !canManageStructure,
  });

  return (
    <div
      ref={setSortRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex max-h-full w-[280px] shrink-0 flex-col rounded-xl border border-border bg-surface/60 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <ColumnHeader
        columnId={column.id}
        name={column.name}
        count={column.cards.length}
        boardId={boardId}
        canEdit={canManageStructure}
        dragHandle={
          canManageStructure ? (
            <span {...attributes} {...listeners}>
              <GripVertical className="h-4 w-4" />
            </span>
          ) : undefined
        }
      />
      <div
        ref={setDropRef}
        className={`min-h-[60px] space-y-2 overflow-y-auto px-2 pb-2 transition-shadow ${
          isOver ? "rounded-lg ring-2 ring-primary/40" : ""
        }`}
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              boardId={boardId}
              dragDisabled={!canEditCards}
            />
          ))}
        </SortableContext>
      </div>
      {canEditCards && (
        <div className="p-2">
          <AddCard columnId={column.id} boardId={boardId} />
        </div>
      )}
    </div>
  );
}
