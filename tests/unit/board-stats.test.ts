import { describe, it, expect } from "vitest";
import { computeBoardProgress, statusCounts } from "@/entities/board/model/stats";
import type { ColumnWithCards } from "@/shared/types/database";

function col(name: string, n: number): ColumnWithCards {
  return {
    id: name, board_id: "b", name, position: name, created_at: "",
    cards: Array.from({ length: n }, (_, i) => ({
      id: `${name}-${i}`, column_id: name, title: "t", description: null, position: "",
      priority: "low", due_date: null, ai_category: null, github_url: null,
      github_pr_state: null,
      created_by: null, created_at: "", updated_at: "", assignees: [], labels: [],
    })),
  };
}

describe("computeBoardProgress", () => {
  it("카드가 없으면 0", () => {
    expect(computeBoardProgress([col("Todo", 0), col("Done", 0)])).toBe(0);
  });
  it("마지막 컬럼 카드 비율을 % 로 반올림", () => {
    expect(computeBoardProgress([col("Todo", 2), col("Doing", 1), col("Done", 1)])).toBe(25);
  });
});

describe("statusCounts", () => {
  it("컬럼별 이름/카운트", () => {
    expect(statusCounts([col("Todo", 2), col("Done", 3)])).toEqual([
      { name: "Todo", count: 2 },
      { name: "Done", count: 3 },
    ]);
  });
});
