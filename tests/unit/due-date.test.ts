import { describe, expect, test } from "vitest";
import {
  toDateInputValue,
  fromDateInputValue,
  dateToInputValue,
  inputValueToDate,
} from "@/entities/card/model/due-date";

/**
 * FR-03: 마감일 입력 변환(date input YYYY-MM-DD ↔ timestamptz ISO).
 * 카드 생성/상세 편집에서 빈값=null(마감일 해제) 규약과 왕복 안정성을 보장한다.
 */
describe("toDateInputValue", () => {
  test("ISO 문자열을 YYYY-MM-DD 로 자른다", () => {
    expect(toDateInputValue("2026-06-04T09:30:00.000Z")).toBe("2026-06-04");
  });

  test("null/빈값/undefined 는 빈 문자열", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue("")).toBe("");
    expect(toDateInputValue(undefined)).toBe("");
  });

  test("잘못된 값은 빈 문자열", () => {
    expect(toDateInputValue("not-a-date")).toBe("");
  });
});

describe("fromDateInputValue", () => {
  test("YYYY-MM-DD 를 자정(UTC) ISO 로 변환", () => {
    expect(fromDateInputValue("2026-06-04")).toBe("2026-06-04T00:00:00.000Z");
  });

  test("빈값/공백은 null(마감일 해제)", () => {
    expect(fromDateInputValue("")).toBeNull();
    expect(fromDateInputValue("   ")).toBeNull();
  });

  test("왕복 변환이 안정적이다", () => {
    const iso = fromDateInputValue("2026-12-31");
    expect(iso).not.toBeNull();
    expect(toDateInputValue(iso)).toBe("2026-12-31");
  });
});

/**
 * DatePicker(Date) ↔ date input 문자열 어댑터.
 * DatePicker 의 Date 는 로컬 자정이라 toISOString(UTC) 으로 포맷하면 타임존에 따라
 * 하루 밀릴 수 있다. dateToInputValue 는 로컬 연/월/일을 직접 써서 이를 방지한다.
 */
describe("dateToInputValue / inputValueToDate", () => {
  test("로컬 자정 Date 를 그 날짜 YYYY-MM-DD 로 포맷(타임존 무관)", () => {
    // 로컬 타임존에서 6/4 자정 — UTC 변환 시 음수 오프셋이면 6/3 으로 밀릴 위험
    const d = new Date(2026, 5, 4); // 월은 0-base → 6월
    expect(dateToInputValue(d)).toBe("2026-06-04");
  });

  test("null/undefined/invalid 는 빈 문자열", () => {
    expect(dateToInputValue(null)).toBe("");
    expect(dateToInputValue(undefined)).toBe("");
    expect(dateToInputValue(new Date("nope"))).toBe("");
  });

  test("inputValueToDate 는 로컬 자정 Date 를 만든다", () => {
    const d = inputValueToDate("2026-06-04");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(4);
  });

  test("빈값/잘못된 값은 null", () => {
    expect(inputValueToDate("")).toBeNull();
    expect(inputValueToDate("   ")).toBeNull();
    expect(inputValueToDate("garbage")).toBeNull();
  });

  test("Date ↔ 문자열 왕복이 안정적", () => {
    const original = "2026-12-31";
    const d = inputValueToDate(original);
    expect(d).not.toBeNull();
    expect(dateToInputValue(d)).toBe(original);
  });

  test("DatePicker → 저장(ISO) 경로: dateToInputValue → fromDateInputValue 연결", () => {
    const d = new Date(2026, 5, 4);
    const iso = fromDateInputValue(dateToInputValue(d));
    expect(iso).toBe("2026-06-04T00:00:00.000Z");
  });
});
