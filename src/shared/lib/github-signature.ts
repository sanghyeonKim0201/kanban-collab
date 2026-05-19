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

/** 커밋 메시지/PR 본문에서 #CARD-xxx 추출 (중복 제거, 명세 8.1) */
export function extractCardIds(text: string): string[] {
  const matches = text.matchAll(/#(CARD-[A-Za-z0-9]+)/g);
  const ids: string[] = [];
  for (const m of matches) {
    if (m[1] && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}
