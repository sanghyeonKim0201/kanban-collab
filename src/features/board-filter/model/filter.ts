import type { CardWithRelations, Priority } from "@/shared/types/database";

export type DueFilter = "all" | "overdue" | "today" | "week" | "none";

export interface FilterCriteria {
  /** 제목 부분일치(대소문자 무시). 공백만이면 무시. */
  searchText: string;
  priority: Priority | "all";
  assigneeId: string | "all";
  due: DueFilter;
}

export const EMPTY_CRITERIA: FilterCriteria = {
  searchText: "",
  priority: "all",
  assigneeId: "all",
  due: "all",
};

/** 어떤 필터든 활성화돼 있으면 true. */
export function isFilterActive(c: FilterCriteria): boolean {
  return (
    c.searchText.trim() !== "" ||
    c.priority !== "all" ||
    c.assigneeId !== "all" ||
    c.due !== "all"
  );
}

/** 로컬 자정(00:00:00.000) 기준의 day 시작 시각(ms). */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 마감일 판정. `now` 는 주입(순수성 위해 Date.now 직접 호출 금지).
 * - overdue: due_date 의 날(day)이 오늘보다 이전
 * - today: due_date 가 오늘
 * - week: 오늘 ~ 오늘+6일(7일 창) 내
 * - none: due_date 없음
 */
function matchesDue(
  due: DueFilter,
  dueDate: string | null,
  now: number,
): boolean {
  if (due === "all") return true;
  if (due === "none") return dueDate === null;
  if (dueDate === null) return false;

  const parsed = Date.parse(dueDate);
  if (Number.isNaN(parsed)) return false;

  const today = startOfDay(now);
  const cardDay = startOfDay(parsed);

  if (due === "overdue") return cardDay < today;
  if (due === "today") return cardDay === today;
  if (due === "week") {
    const weekEnd = today + 7 * 24 * 60 * 60 * 1000; // 오늘 + 7일(7일 창)
    return cardDay >= today && cardDay < weekEnd;
  }
  return true;
}

/** 단일 카드가 기준에 부합하는지(AND 결합). `now` 주입. */
export function matchesCard(
  card: CardWithRelations,
  criteria: FilterCriteria,
  now: number,
): boolean {
  const text = criteria.searchText.trim().toLowerCase();
  if (text !== "" && !card.title.toLowerCase().includes(text)) {
    return false;
  }

  if (criteria.priority !== "all" && card.priority !== criteria.priority) {
    return false;
  }

  if (
    criteria.assigneeId !== "all" &&
    !card.assignees.some((a) => a.id === criteria.assigneeId)
  ) {
    return false;
  }

  if (!matchesDue(criteria.due, card.due_date, now)) {
    return false;
  }

  return true;
}

/** 기준에 부합하는 카드만 반환. */
export function filterCards(
  cards: CardWithRelations[],
  criteria: FilterCriteria,
  now: number,
): CardWithRelations[] {
  if (!isFilterActive(criteria)) return cards;
  return cards.filter((card) => matchesCard(card, criteria, now));
}
