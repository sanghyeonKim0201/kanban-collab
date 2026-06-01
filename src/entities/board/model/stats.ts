import type { ColumnWithCards } from "@/shared/types/database";

/** 전체 카드 중 '마지막(완료) 컬럼' 카드 비율(0-100 정수). */
export function computeBoardProgress(columns: ColumnWithCards[]): number {
  const total = columns.reduce((n, c) => n + c.cards.length, 0);
  if (total === 0) return 0;
  const last = columns[columns.length - 1];
  const done = last ? last.cards.length : 0;
  return Math.round((done / total) * 100);
}

/** 컬럼별 카드 수. */
export function statusCounts(
  columns: ColumnWithCards[],
): { name: string; count: number }[] {
  return columns.map((c) => ({ name: c.name, count: c.cards.length }));
}
