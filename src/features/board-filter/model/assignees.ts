import type { ColumnWithCards, UserProfile } from "@/shared/types/database";

/** 보드의 모든 카드 assignees 에서 중복 제거한 멤버 목록(이름순). */
export function distinctAssignees(columns: ColumnWithCards[]): UserProfile[] {
  const map = new Map<string, UserProfile>();
  for (const col of columns) {
    for (const card of col.cards) {
      for (const a of card.assignees) {
        if (!map.has(a.id)) map.set(a.id, a);
      }
    }
  }
  return [...map.values()].sort((x, y) => {
    const nx = (x.display_name ?? x.email ?? "").toLowerCase();
    const ny = (y.display_name ?? y.email ?? "").toLowerCase();
    return nx < ny ? -1 : nx > ny ? 1 : 0;
  });
}
