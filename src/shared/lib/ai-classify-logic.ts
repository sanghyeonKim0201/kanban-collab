/**
 * AI 분류 보조 순수 로직 (FR-20 마감일 우선순위 보정 / FR-21 담당자 매핑).
 * Supabase·LLM 의존 없이 단위 테스트 가능한 결정적 함수만 모은다.
 */

import type { Priority } from "@/shared/types/database";

const PRIORITY_RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2 };
const RANK_TO_PRIORITY: Priority[] = ["low", "medium", "high"];

/** 마감 임박 기준(일). 이 일수 이내면 우선순위를 한 단계 상향한다. */
export const DUE_SOON_DAYS = 3;

/**
 * FR-20: 마감일이 임박하면(기본 3일 이내) priority 를 한 단계 상향한다.
 * - dueDate 가 없거나 파싱 불가하면 그대로 둔다.
 * - 이미 지난 마감일(now 이후)도 "임박"으로 보고 상향한다.
 * - high 는 더 올릴 수 없으므로 그대로.
 * 순수 함수: now 를 주입받아 결정적으로 테스트한다.
 */
export function bumpPriorityForDueDate(
  priority: Priority,
  dueDate: string | null | undefined,
  now: Date = new Date(),
): Priority {
  if (!dueDate) return priority;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return priority;

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = (due.getTime() - now.getTime()) / msPerDay;
  if (daysUntilDue > DUE_SOON_DAYS) return priority;

  const bumped = Math.min(PRIORITY_RANK[priority] + 1, 2);
  return RANK_TO_PRIORITY[bumped] ?? priority;
}

export interface AssigneeCandidate {
  id: string;
  name: string | null;
}

/**
 * FR-21: LLM/휴리스틱이 추천한 담당자 "이름" → 멤버 id 매핑.
 * - suggestedName 이 null/빈값이면 null.
 * - display_name 또는 email 과 대소문자 무시 정확 일치 우선, 없으면 부분 포함 일치.
 * - 매칭 실패 시 null(존재하지 않는 사람을 지정하지 않는다).
 */
export function matchAssignee(
  suggestedName: string | null | undefined,
  members: AssigneeCandidate[],
): string | null {
  const needle = suggestedName?.trim().toLowerCase();
  if (!needle) return null;

  const exact = members.find(
    (m) => (m.name ?? "").trim().toLowerCase() === needle,
  );
  if (exact) return exact.id;

  const partial = members.find((m) => {
    const hay = (m.name ?? "").trim().toLowerCase();
    return hay !== "" && (hay.includes(needle) || needle.includes(hay));
  });
  return partial?.id ?? null;
}

/**
 * 휴리스틱 폴백용 결정적 담당자 추천(LLM 없이).
 * 멤버가 없으면 null, 있으면 첫 번째 멤버 이름을 반환한다(단순·결정적).
 */
export function heuristicAssigneeName(
  members: AssigneeCandidate[],
): string | null {
  const first = members.find((m) => (m.name ?? "").trim() !== "");
  return first ? (first.name as string) : null;
}
