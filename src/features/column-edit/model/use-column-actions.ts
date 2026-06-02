"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  createColumn,
  renameColumn,
  deleteColumn,
} from "@/entities/column/api/actions";
import { useBoardStore } from "@/entities/board/model/store";

export function useColumnActions(boardId: string) {
  const [pending, start] = useTransition();

  function add(name: string, afterPosition: string | null) {
    start(async () => {
      try {
        await createColumn(boardId, name, afterPosition);
        // 실시간 구독이 columns INSERT 를 resync.
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "컬럼 추가 실패");
      }
    });
  }

  function rename(id: string, name: string) {
    const snapshot = useBoardStore.getState().renameColumnLocal(id, name);
    start(async () => {
      try {
        await renameColumn(id, name, boardId);
      } catch (e) {
        useBoardStore.getState().restore(snapshot);
        toast.error(e instanceof Error ? e.message : "이름 변경 실패");
      }
    });
  }

  function remove(id: string) {
    const snapshot = useBoardStore.getState().removeColumnLocal(id);
    start(async () => {
      try {
        await deleteColumn(id, boardId);
      } catch (e) {
        useBoardStore.getState().restore(snapshot);
        toast.error(e instanceof Error ? e.message : "컬럼 삭제 실패");
      }
    });
  }

  return { pending, add, rename, remove };
}
