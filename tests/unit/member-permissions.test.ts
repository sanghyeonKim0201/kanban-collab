import { describe, expect, test } from "vitest";
import {
  canManageMembers,
  isAssignableRole,
  ownerCount,
  wouldRemoveLastOwner,
  wouldRemoveLastOwnerByDeletion,
} from "@/entities/workspace/model/member-permissions";
import type { Role } from "@/shared/types/database";

describe("canManageMembers (명세 2.3 — owner/admin 만 관리)", () => {
  test("owner → 허용", () => expect(canManageMembers("owner")).toBe(true));
  test("admin → 허용", () => expect(canManageMembers("admin")).toBe(true));
  test("member → 거부", () => expect(canManageMembers("member")).toBe(false));
  test("guest → 거부", () => expect(canManageMembers("guest")).toBe(false));
  test("null(비멤버) → 거부", () =>
    expect(canManageMembers(null)).toBe(false));
});

describe("isAssignableRole (owner 부여 금지)", () => {
  test("admin → true", () => expect(isAssignableRole("admin")).toBe(true));
  test("member → true", () => expect(isAssignableRole("member")).toBe(true));
  test("guest → true", () => expect(isAssignableRole("guest")).toBe(true));
  test("owner → false", () => expect(isAssignableRole("owner")).toBe(false));
  test("쓰레기값 → false", () =>
    expect(isAssignableRole("superadmin")).toBe(false));
});

describe("ownerCount", () => {
  test("owner 0명", () =>
    expect(ownerCount(["admin", "member"] as Role[])).toBe(0));
  test("owner 1명", () =>
    expect(ownerCount(["owner", "member"] as Role[])).toBe(1));
  test("owner 2명", () =>
    expect(ownerCount(["owner", "owner", "guest"] as Role[])).toBe(2));
});

describe("wouldRemoveLastOwner (역할 변경 — 마지막 owner 강등 방지)", () => {
  test("유일 owner 를 member 로 강등 → 차단", () => {
    expect(
      wouldRemoveLastOwner(["owner", "member"] as Role[], "owner", "member"),
    ).toBe(true);
  });
  test("owner 2명 중 1명 강등 → 허용", () => {
    expect(
      wouldRemoveLastOwner(
        ["owner", "owner", "member"] as Role[],
        "owner",
        "member",
      ),
    ).toBe(false);
  });
  test("유일 owner 를 owner 로(변경 없음) → 차단 아님", () => {
    expect(
      wouldRemoveLastOwner(["owner", "member"] as Role[], "owner", "owner"),
    ).toBe(false);
  });
  test("대상이 owner 가 아니면 → 차단 아님", () => {
    expect(
      wouldRemoveLastOwner(["owner", "member"] as Role[], "member", "guest"),
    ).toBe(false);
  });
});

describe("wouldRemoveLastOwnerByDeletion (제거 — 마지막 owner 제거 방지)", () => {
  test("유일 owner 제거 → 차단", () => {
    expect(
      wouldRemoveLastOwnerByDeletion(["owner", "member"] as Role[], "owner"),
    ).toBe(true);
  });
  test("owner 2명 중 1명 제거 → 허용", () => {
    expect(
      wouldRemoveLastOwnerByDeletion(
        ["owner", "owner"] as Role[],
        "owner",
      ),
    ).toBe(false);
  });
  test("owner 아닌 멤버 제거 → 허용", () => {
    expect(
      wouldRemoveLastOwnerByDeletion(["owner", "member"] as Role[], "member"),
    ).toBe(false);
  });
});
