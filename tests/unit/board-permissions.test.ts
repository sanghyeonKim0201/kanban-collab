import { describe, expect, test } from "vitest";
import {
  canEditCards,
  canManageStructure,
} from "@/entities/board/model/permissions";

describe("canManageStructure (FR-27 구조 관리 — owner/admin)", () => {
  test("owner → 허용", () => expect(canManageStructure("owner")).toBe(true));
  test("admin → 허용", () => expect(canManageStructure("admin")).toBe(true));
  test("member → 거부", () => expect(canManageStructure("member")).toBe(false));
  test("guest → 거부", () => expect(canManageStructure("guest")).toBe(false));
  test("null(비멤버) → 거부", () =>
    expect(canManageStructure(null)).toBe(false));
});

describe("canEditCards (FR-27 카드 편집 — owner/admin/member)", () => {
  test("owner → 허용", () => expect(canEditCards("owner")).toBe(true));
  test("admin → 허용", () => expect(canEditCards("admin")).toBe(true));
  test("member → 허용", () => expect(canEditCards("member")).toBe(true));
  test("guest → 거부", () => expect(canEditCards("guest")).toBe(false));
  test("null(비멤버) → 거부", () => expect(canEditCards(null)).toBe(false));
});
