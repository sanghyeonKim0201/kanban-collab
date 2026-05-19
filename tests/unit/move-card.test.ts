import { describe, expect, test } from "vitest";
import { hasConflict, nextPosition } from "@/entities/card/model/move";

describe("hasConflict (명세 10.2 updated_at 기반 충돌 감지)", () => {
  test("expected null → 검사 생략, 충돌 아님", () => {
    expect(hasConflict(null, "2026-05-19T00:00:00Z")).toBe(false);
  });

  test("동일 updated_at → 충돌 아님", () => {
    expect(
      hasConflict("2026-05-19T00:00:00Z", "2026-05-19T00:00:00Z"),
    ).toBe(false);
  });

  test("다른 updated_at → 충돌", () => {
    expect(
      hasConflict("2026-05-19T00:00:00Z", "2026-05-19T01:00:00Z"),
    ).toBe(true);
  });
});

describe("nextPosition (드롭 위치 → lexorank)", () => {
  test("두 카드 사이에 위치", () => {
    const pos = nextPosition("1", "5");
    expect(pos > "1" && pos < "5").toBe(true);
  });

  test("맨 앞 (before=null)", () => {
    const pos = nextPosition(null, "5");
    expect(pos < "5").toBe(true);
  });

  test("맨 뒤 (after=null)", () => {
    const pos = nextPosition("5", null);
    expect(pos > "5").toBe(true);
  });

  test("빈 컬럼 (둘 다 null)", () => {
    const pos = nextPosition(null, null);
    expect(typeof pos).toBe("string");
    expect(pos.length).toBeGreaterThan(0);
  });
});
