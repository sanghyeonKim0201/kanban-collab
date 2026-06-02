/** PR 상태 변화 → 이동 의도. null 이면 이동 안 함(배지만 갱신). */
export type PrTransition = "open" | "done" | null;

/** 카드 PR 상태 배지 값. */
export type PrBadgeState = "open" | "merged" | "closed";

/**
 * GitHub pull_request 이벤트의 action/merged 로 이동 의도를 판정한다.
 * opened/reopened → 'open', closed+merged → 'done', 그 외 → null.
 */
export function resolvePrTransition(action: string, merged: boolean): PrTransition {
  if (action === "opened" || action === "reopened") return "open";
  if (action === "closed" && merged) return "done";
  return null;
}

/** 보드 매핑에서 전이에 해당하는 목표 column_id. 비활성/매핑없음 → null. */
export function pickTargetColumn(
  board: {
    pr_automation_enabled: boolean;
    pr_open_column_id: string | null;
    pr_merged_column_id: string | null;
  },
  transition: PrTransition,
): string | null {
  if (!board.pr_automation_enabled) return null;
  if (transition === "open") return board.pr_open_column_id;
  if (transition === "done") return board.pr_merged_column_id;
  return null;
}

/** 카드 배지에 표시할 PR 상태. */
export function prBadgeState(action: string, merged: boolean): PrBadgeState {
  if (action === "closed" && merged) return "merged";
  if (action === "closed") return "closed";
  return "open";
}
