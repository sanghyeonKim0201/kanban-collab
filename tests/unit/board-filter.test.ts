import { describe, it, expect } from "vitest";
import {
  EMPTY_CRITERIA,
  filterCards,
  isFilterActive,
  matchesCard,
  type FilterCriteria,
} from "@/features/board-filter/model/filter";
import type { CardWithRelations, Priority } from "@/shared/types/database";

// 고정 기준일: 2026-06-04 (로컬). 마감일 케이스를 결정적으로 만들기 위해 정오 사용.
const NOW = new Date(2026, 5, 4, 12, 0, 0).getTime();

function card(
  over: Partial<CardWithRelations> & { id: string },
): CardWithRelations {
  return {
    id: over.id,
    column_id: "c",
    title: over.title ?? "Card",
    description: null,
    position: "",
    priority: over.priority ?? "low",
    due_date: over.due_date ?? null,
    ai_category: null,
    github_url: null,
    github_pr_state: null,
    created_by: null,
    created_at: "",
    updated_at: "",
    assignees: over.assignees ?? [],
    labels: [],
  };
}

function crit(over: Partial<FilterCriteria>): FilterCriteria {
  return { ...EMPTY_CRITERIA, ...over };
}

// 로컬 자정 기준 day 오프셋을 ISO 문자열로.
function dayISO(offsetDays: number): string {
  const d = new Date(2026, 5, 4, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

describe("isFilterActive", () => {
  it("EMPTY_CRITERIA 는 비활성", () => {
    expect(isFilterActive(EMPTY_CRITERIA)).toBe(false);
  });
  it("공백만인 검색어는 비활성", () => {
    expect(isFilterActive(crit({ searchText: "   " }))).toBe(false);
  });
  it("각 필드 설정 시 활성", () => {
    expect(isFilterActive(crit({ searchText: "a" }))).toBe(true);
    expect(isFilterActive(crit({ priority: "high" }))).toBe(true);
    expect(isFilterActive(crit({ assigneeId: "u1" }))).toBe(true);
    expect(isFilterActive(crit({ due: "today" }))).toBe(true);
  });
});

describe("matchesCard - 검색(부분일치, 대소문자 무시)", () => {
  const c = card({ id: "1", title: "Fix Login Bug" });
  it("부분일치 + 대소문자 무시", () => {
    expect(matchesCard(c, crit({ searchText: "login" }), NOW)).toBe(true);
    expect(matchesCard(c, crit({ searchText: "BUG" }), NOW)).toBe(true);
    expect(matchesCard(c, crit({ searchText: "fix login" }), NOW)).toBe(true);
  });
  it("불일치 시 제외", () => {
    expect(matchesCard(c, crit({ searchText: "deploy" }), NOW)).toBe(false);
  });
  it("앞뒤 공백 트림", () => {
    expect(matchesCard(c, crit({ searchText: "  login  " }), NOW)).toBe(true);
  });
});

describe("matchesCard - 우선순위", () => {
  it("정확히 일치할 때만 통과", () => {
    const high = card({ id: "1", priority: "high" });
    const low = card({ id: "2", priority: "low" });
    const p: Priority = "high";
    expect(matchesCard(high, crit({ priority: p }), NOW)).toBe(true);
    expect(matchesCard(low, crit({ priority: p }), NOW)).toBe(false);
  });
});

describe("matchesCard - 담당자", () => {
  const u1 = { id: "u1", email: "a@x.com", display_name: "Alice", avatar_url: null };
  const u2 = { id: "u2", email: "b@x.com", display_name: "Bob", avatar_url: null };
  it("assignee id 포함 여부", () => {
    const c = card({ id: "1", assignees: [u1, u2] });
    expect(matchesCard(c, crit({ assigneeId: "u1" }), NOW)).toBe(true);
    expect(matchesCard(c, crit({ assigneeId: "u3" }), NOW)).toBe(false);
  });
  it("담당자 없는 카드는 특정 담당자 필터에서 제외", () => {
    const c = card({ id: "1", assignees: [] });
    expect(matchesCard(c, crit({ assigneeId: "u1" }), NOW)).toBe(false);
  });
});

describe("matchesCard - 마감일(now 주입)", () => {
  it("overdue: 어제 마감", () => {
    const c = card({ id: "1", due_date: dayISO(-1) });
    expect(matchesCard(c, crit({ due: "overdue" }), NOW)).toBe(true);
  });
  it("overdue: 오늘 마감은 초과 아님", () => {
    const c = card({ id: "1", due_date: dayISO(0) });
    expect(matchesCard(c, crit({ due: "overdue" }), NOW)).toBe(false);
  });
  it("today: 오늘 마감만", () => {
    expect(
      matchesCard(card({ id: "1", due_date: dayISO(0) }), crit({ due: "today" }), NOW),
    ).toBe(true);
    expect(
      matchesCard(card({ id: "2", due_date: dayISO(1) }), crit({ due: "today" }), NOW),
    ).toBe(false);
  });
  it("week: 오늘~6일 후 포함, 7일 후 제외, 과거 제외", () => {
    expect(
      matchesCard(card({ id: "1", due_date: dayISO(0) }), crit({ due: "week" }), NOW),
    ).toBe(true);
    expect(
      matchesCard(card({ id: "2", due_date: dayISO(6) }), crit({ due: "week" }), NOW),
    ).toBe(true);
    expect(
      matchesCard(card({ id: "3", due_date: dayISO(7) }), crit({ due: "week" }), NOW),
    ).toBe(false);
    expect(
      matchesCard(card({ id: "4", due_date: dayISO(-1) }), crit({ due: "week" }), NOW),
    ).toBe(false);
  });
  it("none: 마감일 없는 카드만", () => {
    expect(
      matchesCard(card({ id: "1", due_date: null }), crit({ due: "none" }), NOW),
    ).toBe(true);
    expect(
      matchesCard(card({ id: "2", due_date: dayISO(0) }), crit({ due: "none" }), NOW),
    ).toBe(false);
  });
  it("overdue/today/week 는 마감일 없으면 제외", () => {
    const c = card({ id: "1", due_date: null });
    expect(matchesCard(c, crit({ due: "overdue" }), NOW)).toBe(false);
    expect(matchesCard(c, crit({ due: "today" }), NOW)).toBe(false);
    expect(matchesCard(c, crit({ due: "week" }), NOW)).toBe(false);
  });
});

describe("matchesCard - 복합(AND)", () => {
  const u1 = { id: "u1", email: null, display_name: "Alice", avatar_url: null };
  it("모든 조건 동시 충족", () => {
    const c = card({
      id: "1",
      title: "Deploy pipeline",
      priority: "high",
      assignees: [u1],
      due_date: dayISO(0),
    });
    const all = crit({
      searchText: "deploy",
      priority: "high",
      assigneeId: "u1",
      due: "today",
    });
    expect(matchesCard(c, all, NOW)).toBe(true);
  });
  it("하나라도 어긋나면 제외", () => {
    const c = card({
      id: "1",
      title: "Deploy pipeline",
      priority: "low",
      assignees: [u1],
      due_date: dayISO(0),
    });
    const all = crit({ searchText: "deploy", priority: "high" });
    expect(matchesCard(c, all, NOW)).toBe(false);
  });
});

describe("filterCards", () => {
  const cards = [
    card({ id: "1", title: "Alpha", priority: "high" }),
    card({ id: "2", title: "Beta", priority: "low" }),
    card({ id: "3", title: "Alphabet", priority: "low" }),
  ];
  it("비활성 기준이면 원본 그대로 반환", () => {
    expect(filterCards(cards, EMPTY_CRITERIA, NOW)).toBe(cards);
  });
  it("검색어로 부분일치 필터", () => {
    const out = filterCards(cards, crit({ searchText: "alpha" }), NOW);
    expect(out.map((c) => c.id)).toEqual(["1", "3"]);
  });
  it("우선순위 필터", () => {
    const out = filterCards(cards, crit({ priority: "low" }), NOW);
    expect(out.map((c) => c.id)).toEqual(["2", "3"]);
  });
});
