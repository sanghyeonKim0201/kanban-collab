import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  extractCardIds,
  verifySignature,
} from "@/shared/lib/github-signature";

const SECRET = "topsecret";
const BODY = JSON.stringify({ hello: "world" });

function sign(body: string, secret: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifySignature (명세 8.1 HMAC-SHA256)", () => {
  test("유효한 서명 → true", () => {
    expect(verifySignature(BODY, SECRET, sign(BODY, SECRET))).toBe(true);
  });

  test("본문 변조 → false", () => {
    expect(
      verifySignature(BODY + "x", SECRET, sign(BODY, SECRET)),
    ).toBe(false);
  });

  test("잘못된 시크릿 → false", () => {
    expect(verifySignature(BODY, SECRET, sign(BODY, "wrong"))).toBe(false);
  });

  test("헤더 없음 → false", () => {
    expect(verifySignature(BODY, SECRET, null)).toBe(false);
  });

  test("형식 불일치(sha1=) → false", () => {
    expect(verifySignature(BODY, SECRET, "sha1=abc")).toBe(false);
  });

  test("길이 다른 서명 → false (timing-safe)", () => {
    expect(verifySignature(BODY, SECRET, "sha256=deadbeef")).toBe(false);
  });
});

describe("extractCardIds (커밋/PR 본문에서 #CARD-xxx)", () => {
  test("단일 카드 ID", () => {
    expect(extractCardIds("fix bug #CARD-123")).toEqual(["CARD-123"]);
  });

  test("복수 + 중복 제거", () => {
    expect(
      extractCardIds("merge #CARD-1 and #CARD-2, also #CARD-1"),
    ).toEqual(["CARD-1", "CARD-2"]);
  });

  test("없으면 빈 배열", () => {
    expect(extractCardIds("no refs here")).toEqual([]);
  });
});
