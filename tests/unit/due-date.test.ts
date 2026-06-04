import { describe, expect, test } from "vitest";
import {
  toDateInputValue,
  fromDateInputValue,
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
