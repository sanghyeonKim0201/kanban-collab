import type { Role } from "@/shared/types/database";

/**
 * 명세 2.3 "관리자: 팀원 초대/관리".
 * 멤버 초대/역할변경/제거는 owner/admin 만. guest/member/비멤버는 읽기 전용.
 */
export function canManageMembers(role: Role | null): boolean {
  return role === "owner" || role === "admin";
}

/** 초대/역할변경에서 부여 가능한 역할 — owner 부여는 금지(보수적). */
export const ASSIGNABLE_ROLES: Role[] = ["admin", "member", "guest"];

export function isAssignableRole(role: string): role is Role {
  return (ASSIGNABLE_ROLES as string[]).includes(role);
}

/** 워크스페이스의 owner 수 — 마지막 owner 보호 판정에 사용. */
export function ownerCount(roles: readonly Role[]): number {
  return roles.filter((r) => r === "owner").length;
}

/**
 * 역할 변경이 마지막 owner 를 강등시키는지 판정.
 * - 대상이 현재 owner 이고, owner 가 1명뿐이며, 새 역할이 owner 가 아니면 차단.
 */
export function wouldRemoveLastOwner(
  allRoles: readonly Role[],
  targetCurrentRole: Role,
  nextRole: Role,
): boolean {
  if (targetCurrentRole !== "owner") return false;
  if (nextRole === "owner") return false;
  return ownerCount(allRoles) <= 1;
}

/**
 * 제거가 마지막 owner 를 없애는지 판정.
 * - 대상이 owner 이고 owner 가 1명뿐이면 차단.
 */
export function wouldRemoveLastOwnerByDeletion(
  allRoles: readonly Role[],
  targetCurrentRole: Role,
): boolean {
  if (targetCurrentRole !== "owner") return false;
  return ownerCount(allRoles) <= 1;
}
