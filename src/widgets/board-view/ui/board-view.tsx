"use client";

import { useEffect, useState } from "react";
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
import { WorkPane } from "@/widgets/app-shell/ui/work-pane";
import { BoardColumn } from "./board-column";
import { BoardToolbar, type BoardViewMode } from "./board-toolbar";
import { BoardContextPanel } from "./board-context-panel";
import { BoardListView } from "./board-list-view";

export function BoardView({ initial }: { initial: BoardWithColumns }) {
  const setBoard = useBoardStore((s) => s.setBoard);
  const columns = useBoardStore((s) => s.columns);
  const { onDragEnd } = useCardDnd(initial.id);
  const [mode, setMode] = useState<BoardViewMode>("board");
  useBoardRealtime(initial.id);

  useEffect(() => {
    setBoard(initial);
  }, [initial, setBoard]);

  // 명세 10.3: dnd-kit 키보드 접근성
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <WorkPane
      secondary={<BoardContextPanel />}
      toolbar={<BoardToolbar name={initial.name} mode={mode} onMode={setMode} />}
    >
      {mode === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={onDragEnd}
        >
          <div className="flex h-full gap-4 overflow-x-auto p-6">
            {columns.map((col) => (
              <BoardColumn key={col.id} column={col} boardId={initial.id} />
            ))}
          </div>
        </DndContext>
      ) : (
        <BoardListView boardId={initial.id} />
      )}
    </WorkPane>
  );
}
