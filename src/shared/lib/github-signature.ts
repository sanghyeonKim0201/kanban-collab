import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 명세 8.1: X-Hub-Signature-256 HMAC-SHA256 검증 (timing-safe).
 * 형식: "sha256=<hex>"
 */
export function verifySignature(
  rawBody: string,
  secret: string,
  header: string | null,
): boolean {
  if (!header || !secret) return false;
  if (!header.startsWith("sha256=")) return false;

  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * 커밋 메시지/PR 본문에서 카드 참조 추출 (중복 제거, 명세 8.1 / FR-18).
 *
 * 지원 형식:
 *   - `#CARD-123`   — 기존 형식(선행 `#`), 하위호환
 *   - `TF-123`      — 프로젝트 약어 + 식별자(선행 `#` 선택)
 *
 * 패턴: `#?` 선택 + 대문자 2글자 이상 약어 + `-` + 영숫자 식별자.
 * 단어경계로 감싸 일반 산문 단어 오매칭을 막는다.
 *   - 약어를 `[A-Z]{2,}` 로 제한 → 소문자/혼합 단어(`fix-it`, `a-b`)는 미매칭.
 *   - 선행 경계 `(?<![A-Za-z0-9])` → `XTF-1` 처럼 식별자 중간을 자르지 않음.
 *   - 식별자 `[A-Za-z0-9]+` → 후행은 영숫자가 아니어야 끝남(예: `TF-1.` → `TF-1`).
 * 반환값은 `#` 를 제거한 참조 문자열(예: `CARD-123`, `TF-123`).
 */
export function extractCardIds(text: string): string[] {
  const matches = text.matchAll(/(?<![A-Za-z0-9])#?([A-Z]{2,}-[A-Za-z0-9]+)/g);
  const ids: string[] = [];
  for (const m of matches) {
    if (m[1] && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}
