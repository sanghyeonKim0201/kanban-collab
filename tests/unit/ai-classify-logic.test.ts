import { describe, expect, test } from "vitest";
import {
  bumpPriorityForDueDate,
  matchAssignee,
  heuristicAssigneeName,
  DUE_SOON_DAYS,
} from "@/shared/lib/ai-classify-logic";

const NOW = new Date("2026-06-04T00:00:00.000Z");
const inDays = (n: number) =>
  new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

describe("bumpPriorityForDueDate (FR-20 마감 임박 상향)", () => {
  test("마감일 없음 → 그대로", () => {
    expect(bumpPriorityForDueDate("low", null, NOW)).toBe("low");
    expect(bumpPriorityForDueDate("medium", undefined, NOW)).toBe("medium");
  });

  test("임박(3일 이내) → 한 단계 상향", () => {
    expect(bumpPriorityForDueDate("low", inDays(2), NOW)).toBe("medium");
    expect(bumpPriorityForDueDate("medium", inDays(DUE_SOON_DAYS), NOW)).toBe(
      "high",
    );
  });

  test("이미 지난 마감일도 상향", () => {
    expect(bumpPriorityForDueDate("low", inDays(-5), NOW)).toBe("medium");
  });

  test("여유 있는 마감일(3일 초과) → 그대로", () => {
    expect(bumpPriorityForDueDate("low", inDays(10), NOW)).toBe("low");
  });

  test("high 는 더 올라가지 않음", () => {
    expect(bumpPriorityForDueDate("high", inDays(1), NOW)).toBe("high");
  });

  test("파싱 불가한 날짜 → 그대로", () => {
    expect(bumpPriorityForDueDate("medium", "not-a-date", NOW)).toBe("medium");
  });
});

describe("matchAssignee (FR-21 이름 → id 매핑)", () => {
  const members = [
    { id: "u1", name: "Alice Kim" },
    { id: "u2", name: "Bob Lee" },
    { id: "u3", name: null },
  ];

  test("null/빈값 → null", () => {
    expect(matchAssignee(null, members)).toBeNull();
    expect(matchAssignee("   ", members)).toBeNull();
  });

  test("정확 일치(대소문자 무시)", () => {
    expect(matchAssignee("alice kim", members)).toBe("u1");
  });

  test("부분 포함 일치", () => {
    expect(matchAssignee("Bob", members)).toBe("u2");
  });

  test("매칭 실패 → null (없는 사람 지정 안 함)", () => {
    expect(matchAssignee("Charlie", members)).toBeNull();
  });

  test("이름 없는 멤버는 매칭되지 않음", () => {
    expect(matchAssignee("", members)).toBeNull();
  });
});

describe("heuristicAssigneeName (폴백 결정적 추천)", () => {
  test("멤버 없음 → null", () => {
    expect(heuristicAssigneeName([])).toBeNull();
  });

  test("첫 유효 이름 멤버", () => {
    expect(
      heuristicAssigneeName([
        { id: "u0", name: null },
        { id: "u1", name: "Alice" },
      ]),
    ).toBe("Alice");
  });
});
