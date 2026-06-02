import { describe, it, expect, beforeEach } from "vitest";
import { useBoardStore } from "@/entities/board/model/store";
import type { BoardWithColumns, ColumnWithCards } from "@/shared/types/database";

function col(id: string, name: string, position: string): ColumnWithCards {
  return { id, board_id: "b", name, position, created_at: "", cards: [] };
}
function board(cols: ColumnWithCards[]): BoardWithColumns {
  return {
    id: "b", workspace_id: "w", name: "B", github_repo: null,
    created_at: "", columns: cols,
  };
}

describe("board store 컬럼 메서드", () => {
  beforeEach(() => {
    useBoardStore.getState().setBoard(
      board([col("c1", "To Do", "1"), col("c2", "Done", "2")]),
    );
  });

  it("renameColumnLocal 은 이름을 바꾸고 스냅샷을 반환", () => {
    const snap = useBoardStore.getState().renameColumnLocal("c1", "Backlog");
    expect(useBoardStore.getState().columns[0]?.name).toBe("Backlog");
    expect(snap[0]?.name).toBe("To Do");
  });

  it("removeColumnLocal 은 컬럼을 제거하고 스냅샷을 반환", () => {
    const snap = useBoardStore.getState().removeColumnLocal("c1");
    expect(useBoardStore.getState().columns.map((c) => c.id)).toEqual(["c2"]);
    expect(snap).toHaveLength(2);
  });

  it("reorderColumnLocal 은 컬럼을 toIndex 로 이동하고 position 을 갱신", () => {
    useBoardStore.getState().reorderColumnLocal("c2", 0, "0");
    const cols = useBoardStore.getState().columns;
    expect(cols.map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(cols[0]?.position).toBe("0");
  });

  it("restore 로 스냅샷 복원", () => {
    const snap = useBoardStore.getState().removeColumnLocal("c1");
    useBoardStore.getState().restore(snap);
    expect(useBoardStore.getState().columns).toHaveLength(2);
  });
});
