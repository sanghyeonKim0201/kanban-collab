import type { Role } from "@/shared/types/database";

/**
 * FR-27: 역할별 편집 권한을 두 축으로 분리한다. RLS(마이그레이션 0002)와 1:1.
 *
 * - canManageStructure: 컬럼 구조 변경(추가/이름변경/삭제/재정렬), 보드 이름변경/삭제,
 *   PR 자동화 설정. owner/admin 만.
 * - canEditCards: 카드 생성/수정/이동/삭제, 라벨, 댓글. owner/admin/member.
 *
 * guest 와 비멤버(null)는 둘 다 false → 읽기 전용.
 */
export function canManageStructure(role: Role | null): boolean {
  return role === "owner" || role === "admin";
}

export function canEditCards(role: Role | null): boolean {
  return role === "owner" || role === "admin" || role === "member";
}
