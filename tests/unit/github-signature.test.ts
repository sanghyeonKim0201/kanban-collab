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

describe("extractCardIds (커밋/PR 본문에서 카드 참조)", () => {
  test("단일 카드 ID (#CARD-xxx 하위호환)", () => {
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

  // ── FR-18: TF-123 형식 지원 ──
  test("TF-123 형식 (선행 # 없음)", () => {
    expect(extractCardIds("close TF-123")).toEqual(["TF-123"]);
  });

  test("#TF-1 형식 (선행 # 있음, # 제거)", () => {
    expect(extractCardIds("ref #TF-1")).toEqual(["TF-1"]);
  });

  test("CARD-xxx 와 TF-xxx 혼합", () => {
    expect(extractCardIds("#CARD-9 and TF-42 done")).toEqual([
      "CARD-9",
      "TF-42",
    ]);
  });

  test("소문자 약어는 미매칭 (tf-1)", () => {
    expect(extractCardIds("tf-1 lowercase")).toEqual([]);
  });

  test("한 글자 약어는 미매칭 (A-1)", () => {
    expect(extractCardIds("see A-1 here")).toEqual([]);
  });

  test("소문자/숫자 뒤 부분문자열을 자르지 않음 (xTF-1 미매칭)", () => {
    // 선행 경계 (?<![A-Za-z0-9]) 가 더 큰 토큰 중간의 TF-1 매칭을 막는다.
    expect(extractCardIds("xTF-1 and a1TF-2")).toEqual([]);
  });

  test("후행 비영숫자에서 끝남 (TF-1. → TF-1)", () => {
    expect(extractCardIds("done TF-1.")).toEqual(["TF-1"]);
  });

  test("같은 TF 참조 중복 제거", () => {
    expect(extractCardIds("TF-7 then TF-7 again")).toEqual(["TF-7"]);
  });
});
