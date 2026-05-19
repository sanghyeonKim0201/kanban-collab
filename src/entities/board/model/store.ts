"use client";

import { create } from "zustand";
import type {
  BoardWithColumns,
  CardWithRelations,
  ColumnWithCards,
} from "@/shared/types/database";

interface BoardState {
  boardId: string;
  columns: ColumnWithCards[];
  setBoard: (board: BoardWithColumns) => void;
  /** 낙관적 카드 이동. 롤백을 위해 이전 스냅샷을 반환. */
  moveCardLocal: (
    cardId: string,
    toColumnId: string,
    toIndex: number,
  ) => ColumnWithCards[];
  restore: (snapshot: ColumnWithCards[]) => void;
  upsertCard: (card: CardWithRelations) => void;
  removeCard: (cardId: string) => void;
}

function clone(cols: ColumnWithCards[]): ColumnWithCards[] {
  return cols.map((c) => ({ ...c, cards: c.cards.map((card) => ({ ...card })) }));
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boardId: "",
  columns: [],

  setBoard: (board) =>
    set({ boardId: board.id, columns: board.columns }),

  moveCardLocal: (cardId, toColumnId, toIndex) => {
    const snapshot = clone(get().columns);
    const next = clone(get().columns);

    let moved: CardWithRelations | undefined;
    for (const col of next) {
      const idx = col.cards.findIndex((c) => c.id === cardId);
      if (idx !== -1) {
        moved = col.cards.splice(idx, 1)[0];
        break;
      }
    }
    if (!moved) return snapshot;

    const target = next.find((c) => c.id === toColumnId);
    if (!target) return snapshot;

    moved.column_id = toColumnId;
    const clamped = Math.max(0, Math.min(toIndex, target.cards.length));
    target.cards.splice(clamped, 0, moved);

    set({ columns: next });
    return snapshot;
  },

  restore: (snapshot) => set({ columns: snapshot }),

  upsertCard: (card) =>
    set((state) => ({
      columns: state.columns.map((col) => {
        const without = col.cards.filter((c) => c.id !== card.id);
        if (col.id === card.column_id) {
          return {
            ...col,
            cards: [...without, card].sort((a, b) =>
              a.position < b.position ? -1 : 1,
            ),
          };
        }
        return { ...col, cards: without };
      }),
    })),

  removeCard: (cardId) =>
    set((state) => ({
      columns: state.columns.map((col) => ({
        ...col,
        cards: col.cards.filter((c) => c.id !== cardId),
      })),
    })),
}));
