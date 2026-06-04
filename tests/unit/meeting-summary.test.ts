import { describe, expect, test } from "vitest";
import {
  parseMeetingSummary,
  heuristicMeetingSummary,
} from "@/shared/lib/parse-meeting-summary";

describe("parseMeetingSummary (FR-23 구조화 파싱)", () => {
  test("완전한 구조화 JSON", () => {
    const r = parseMeetingSummary(
      JSON.stringify({
        summary: "프로젝트 일정 논의",
        attendees: ["Alice", "Bob"],
        agenda: ["일정", "리소스"],
        discussion: "마감일을 앞당길지 논의함",
        decisions: ["마감 2주 연장"],
        actionItems: [{ title: "WBS 작성", suggestedAssignee: "  Alice  " }],
      }),
    );
    expect(r.summary).toBe("프로젝트 일정 논의");
    expect(r.attendees).toEqual(["Alice", "Bob"]);
    expect(r.agenda).toEqual(["일정", "리소스"]);
    expect(r.discussion).toBe("마감일을 앞당길지 논의함");
    expect(r.decisions).toEqual(["마감 2주 연장"]);
    expect(r.actionItems).toEqual([
      { title: "WBS 작성", suggestedAssignee: "Alice" },
    ]);
  });

  test("구버전 {summary, actionItems} 응답 하위 호환 — 누락 필드는 빈값", () => {
    const r = parseMeetingSummary(
      '{"summary":"요약","actionItems":[{"title":"할일","suggestedAssignee":null}]}',
    );
    expect(r.summary).toBe("요약");
    expect(r.attendees).toEqual([]);
    expect(r.agenda).toEqual([]);
    expect(r.discussion).toBe("");
    expect(r.decisions).toEqual([]);
    expect(r.actionItems).toEqual([
      { title: "할일", suggestedAssignee: null },
    ]);
  });

  test("배열 내 비문자/빈문자 요소 제거 + trim", () => {
    const r = parseMeetingSummary(
      JSON.stringify({
        summary: "s",
        attendees: ["  Alice ", "", null, 42, "Bob"],
        decisions: ["  결정 "],
      }),
    );
    expect(r.attendees).toEqual(["Alice", "Bob"]);
    expect(r.decisions).toEqual(["결정"]);
  });

  test("코드펜스 + 잡텍스트 제거", () => {
    const r = parseMeetingSummary(
      '응답:\n```json\n{"summary":"요약","attendees":["A"]}\n```\n',
    );
    expect(r.summary).toBe("요약");
    expect(r.attendees).toEqual(["A"]);
  });

  test("actionItems suggestedAssignee 빈문자 → null", () => {
    const r = parseMeetingSummary(
      '{"summary":"s","actionItems":[{"title":"t","suggestedAssignee":""}]}',
    );
    expect(r.actionItems[0]?.suggestedAssignee).toBeNull();
  });

  test("JSON 아님 → 에러", () => {
    expect(() => parseMeetingSummary("no json here")).toThrow();
  });

  test("actionItems title 누락 → 에러", () => {
    expect(() =>
      parseMeetingSummary('{"summary":"s","actionItems":[{"suggestedAssignee":"A"}]}'),
    ).toThrow();
  });
});

describe("heuristicMeetingSummary (FR-23 폴백)", () => {
  test("동일한 구조 형태 반환 — summary/discussion 채우고 나머지 빈값", () => {
    const r = heuristicMeetingSummary("회의 내용입니다.".repeat(50));
    expect(r.summary.length).toBeLessThanOrEqual(280);
    expect(r.discussion.length).toBeLessThanOrEqual(1000);
    expect(r.attendees).toEqual([]);
    expect(r.agenda).toEqual([]);
    expect(r.decisions).toEqual([]);
    expect(r.actionItems).toEqual([]);
  });

  test("빈 transcript → 모든 필드 빈값", () => {
    const r = heuristicMeetingSummary("   ");
    expect(r.summary).toBe("");
    expect(r.discussion).toBe("");
  });
});
