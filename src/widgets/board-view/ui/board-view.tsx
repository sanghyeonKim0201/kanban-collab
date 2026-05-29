"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Search, X } from "lucide-react";
import { useBoardStore } from "@/entities/board/model/store";
import { useBoardRealtime } from "@/entities/board/model/use-board-realtime";
import { useCardDnd } from "@/features/card-drag/model/use-card-dnd";
import { AddColumn } from "@/features/column-create/ui/add-column";
import { cn } from "@/shared/lib/cn";
import { Input } from "@/shared/ui/input";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import type { MemberRow } from "@/entities/workspace/api/queries";
import type {
  BoardWithColumns,
  CardWithRelations,
  Priority,
} from "@/shared/types/database";
import { BoardColumn } from "./board-column";
import { CardOverlay } from "./card-item";

const PRIORITIES: Priority[] = ["low", "medium", "high"];
const PRIORITY_LABEL: Record<Priority, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

export function BoardView({
  initial,
  members,
}: {
  initial: BoardWithColumns;
  members: MemberRow[];
}) {
  const setBoard = useBoardStore((s) => s.setBoard);
  const columns = useBoardStore((s) => s.columns);
  const { onDragEnd } = useCardDnd(initial.id);
  const [activeCard, setActiveCard] = useState<CardWithRelations | null>(null);

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);

  useBoardRealtime(initial.id);

  useEffect(() => {
    setBoard(initial);
  }, [initial, setBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const filtersActive =
    search.trim() !== "" ||
    priorityFilter.length > 0 ||
    assigneeFilter.length > 0;

  const { displayColumns, hiddenCount } = useMemo(() => {
    if (!filtersActive) return { displayColumns: columns, hiddenCount: 0 };
    const q = search.trim().toLowerCase();
    let hidden = 0;
    const next = columns.map((col) => {
      const cards = col.cards.filter((card) => {
        if (
          q &&
          !`${card.title} ${card.description ?? ""}`.toLowerCase().includes(q)
        )
          return false;
        if (priorityFilter.length && !priorityFilter.includes(card.priority))
          return false;
        if (
          assigneeFilter.length &&
          !card.assignees.some((a) => assigneeFilter.includes(a.id))
        )
          return false;
        return true;
      });
      hidden += col.cards.length - cards.length;
      return { ...col, cards };
    });
    return { displayColumns: next, hiddenCount: hidden };
  }, [columns, search, priorityFilter, assigneeFilter, filtersActive]);

  function togglePriority(p: Priority) {
    setPriorityFilter((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }
  function toggleAssignee(id: string) {
    setAssigneeFilter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function clearFilters() {
    setSearch("");
    setPriorityFilter([]);
    setAssigneeFilter([]);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    for (const col of useBoardStore.getState().columns) {
      const found = col.cards.find((c) => c.id === id);
      if (found) {
        setActiveCard(found);
        return;
      }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    await onDragEnd(event);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-6 py-3">
        <h1 className="text-lg font-bold">{initial.name}</h1>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="카드 검색"
              className="h-8 w-44 pl-8"
            />
          </div>

          <div className="flex items-center gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePriority(p)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  priorityFilter.includes(p)
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>

          {members.length > 0 && (
            <div className="flex items-center gap-1">
              {members.map((m) => (
                <button
                  key={m.user.id}
                  type="button"
                  onClick={() => toggleAssignee(m.user.id)}
                  title={m.user.display_name ?? m.user.email ?? ""}
                  className={cn(
                    "rounded-full transition",
                    assigneeFilter.includes(m.user.id)
                      ? "ring-2 ring-primary"
                      : "opacity-50 hover:opacity-100",
                  )}
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">
                      {(m.user.display_name ?? m.user.email ?? "?")
                        .charAt(0)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              ))}
            </div>
          )}

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> 초기화
              {hiddenCount > 0 && (
                <span className="tabular-nums">({hiddenCount}개 숨김)</span>
              )}
            </button>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCard(null)}
      >
        <div className="flex flex-1 items-start gap-4 overflow-x-auto p-6">
          {displayColumns.map((col) => (
            <BoardColumn
              key={col.id}
              column={col}
              boardId={initial.id}
              members={members}
            />
          ))}
          <AddColumn
            boardId={initial.id}
            afterPosition={columns.at(-1)?.position ?? null}
          />
        </div>
        <DragOverlay>
          {activeCard ? <CardOverlay card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
