import { between } from "@/shared/lib/lexorank";

/**
 * 명세 10.2: 동시 편집 시 updated_at 기반 충돌 감지.
 * 클라이언트가 알고 있던 updated_at(expected)과 DB 의 현재 값(current)이
 * 다르면 충돌 — 낙관적 UI 를 롤백해야 한다. expected 가 null 이면 검사 생략.
 */
export function hasConflict(
  expected: string | null,
  current: string,
): boolean {
  if (expected === null) return false;
  return new Date(expected).getTime() !== new Date(current).getTime();
}

/** 드롭 지점의 앞/뒤 카드 position 으로 새 position 계산 */
export function nextPosition(
  before: string | null,
  after: string | null,
): string {
  return between(before, after);
}
