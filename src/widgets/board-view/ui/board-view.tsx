"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useBoardStore } from "@/entities/board/model/store";
import { useBoardRealtime } from "@/entities/board/model/use-board-realtime";
import { useCardDnd } from "@/features/card-drag/model/use-card-dnd";
import type { BoardWithColumns, BoardActivity } from "@/shared/types/database";
import { WorkPane } from "@/widgets/app-shell/ui/work-pane";
import { AddColumn } from "@/features/column-edit/ui/add-column";
import { BoardColumn } from "./board-column";
import { BoardToolbar, type BoardViewMode } from "./board-toolbar";
import { BoardContextPanel } from "./board-context-panel";
import { BoardListView } from "./board-list-view";
import { BoardMenu } from "@/features/board-edit/ui/board-menu";
import { BoardFilterBar } from "@/features/board-filter/ui/board-filter-bar";
import {
  EMPTY_CRITERIA,
  filterCards,
  isFilterActive,
  type FilterCriteria,
} from "@/features/board-filter/model/filter";
import { distinctAssignees } from "@/features/board-filter/model/assignees";

export function BoardView({
  initial,
  canManageStructure,
  canEditCards,
  initialActivity,
}: {
  initial: BoardWithColumns;
  canManageStructure: boolean;
  canEditCards: boolean;
  initialActivity: BoardActivity[];
}) {
  const setBoard = useBoardStore((s) => s.setBoard);
  const columns = useBoardStore((s) => s.columns);
  const { onDragEnd } = useCardDnd(initial.id);
  const [mode, setMode] = useState<BoardViewMode>("board");
  const [criteria, setCriteria] = useState<FilterCriteria>(EMPTY_CRITERIA);
  useBoardRealtime(initial.id);

  useEffect(() => {
    setBoard(initial);
  }, [initial, setBoard]);

  // 보드 전환 시 필터 리셋(persist 불필요).
  useEffect(() => {
    setCriteria(EMPTY_CRITERIA);
  }, [initial.id]);

  const active = isFilterActive(criteria);
  const assigneeOptions = useMemo(
    () => distinctAssignees(columns),
    [columns],
  );

  // 필터는 표시 레이어만 — 컬럼 구조는 유지, 매칭 안 되는 카드만 숨김.
  // now 는 렌더마다 평가(마감일 today/week 기준일). 순수 필터엔 인자로 주입.
  const visibleColumns = useMemo(() => {
    if (!active) return columns;
    const now = Date.now();
    return columns.map((col) => ({
      ...col,
      cards: filterCards(col.cards, criteria, now),
    }));
  }, [columns, criteria, active]);

  // 명세 10.3: dnd-kit 키보드 접근성
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <WorkPane
      secondary={
        <BoardContextPanel
          boardId={initial.id}
          canManageStructure={canManageStructure}
          prAutomation={{
            enabled: initial.pr_automation_enabled,
            openColumnId: initial.pr_open_column_id,
            mergedColumnId: initial.pr_merged_column_id,
          }}
          initialActivity={initialActivity}
        />
      }
      toolbar={
        <BoardToolbar
          name={initial.name}
          mode={mode}
          onMode={setMode}
          menu={
            canManageStructure ? (
              <BoardMenu
                boardId={initial.id}
                workspaceId={initial.workspace_id}
                name={initial.name}
              />
            ) : undefined
          }
          right={
            <BoardFilterBar
              criteria={criteria}
              onChange={setCriteria}
              assignees={assigneeOptions}
            />
          }
        />
      }
    >
      {mode === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={onDragEnd}
        >
          <div className="flex h-full items-start gap-4 overflow-x-auto p-6">
            <SortableContext
              items={columns.map((c) => `colsort-${c.id}`)}
              strategy={horizontalListSortingStrategy}
            >
              {visibleColumns.map((col) => (
                <BoardColumn
                  key={col.id}
                  column={col}
                  boardId={initial.id}
                  canManageStructure={canManageStructure}
                  canEditCards={canEditCards}
                />
              ))}
            </SortableContext>
            {canManageStructure && (
              <AddColumn
                boardId={initial.id}
                lastPosition={
                  columns.length ? columns[columns.length - 1]!.position : null
                }
              />
            )}
          </div>
        </DndContext>
      ) : (
        <BoardListView columns={visibleColumns} boardId={initial.id} />
      )}
    </WorkPane>
  );
}
