"use client";

import { useEffect } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useBoardStore } from "@/entities/board/model/store";
import { useBoardRealtime } from "@/entities/board/model/use-board-realtime";
import { useCardDnd } from "@/features/card-drag/model/use-card-dnd";
import type { BoardWithColumns } from "@/shared/types/database";
import { BoardColumn } from "./board-column";

export function BoardView({ initial }: { initial: BoardWithColumns }) {
  const setBoard = useBoardStore((s) => s.setBoard);
  const columns = useBoardStore((s) => s.columns);
  const { onDragEnd } = useCardDnd(initial.id);
  useBoardRealtime(initial.id);

  useEffect(() => {
    setBoard(initial);
  }, [initial, setBoard]);

  // 명세 10.3: dnd-kit 키보드 접근성
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-b px-6 py-3">
        <h1 className="text-lg font-bold">{initial.name}</h1>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {columns.map((col) => (
            <BoardColumn key={col.id} column={col} boardId={initial.id} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
