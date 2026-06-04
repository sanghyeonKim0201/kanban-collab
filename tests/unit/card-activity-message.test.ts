import { describe, expect, test } from "vitest";
import {
  cardCreatedMessage,
  cardDeletedMessage,
  cardMovedMessage,
  cardUpdatedMessage,
} from "@/entities/card/model/activity-message";

/**
 * FR-09: 카드 변경 활동 이력 문구 생성. 피드에 남는 사람이 읽는 문장의
 * 회귀를 잡는다(제목 미상·필드 미상 시 일반화 폴백 포함).
 */
describe("cardCreatedMessage", () => {
  test("제목을 따옴표로 감싼 생성 문구", () => {
    expect(cardCreatedMessage("로그인 버그")).toBe("📝 '로그인 버그' 카드 생성");
  });
});

describe("cardDeletedMessage", () => {
  test("제목이 있으면 제목 포함", () => {
    expect(cardDeletedMessage("배포 준비")).toBe("🗑️ '배포 준비' 카드 삭제");
  });

  test("제목 미상(null/undefined)이면 일반화", () => {
    expect(cardDeletedMessage(null)).toBe("🗑️ 카드 삭제");
    expect(cardDeletedMessage(undefined)).toBe("🗑️ 카드 삭제");
  });
});

describe("cardMovedMessage", () => {
  test("제목 + 컬럼 모두 있을 때", () => {
    expect(cardMovedMessage("기능 A", "완료")).toBe(
      "↔️ '기능 A' 카드를 '완료'(으)로 이동",
    );
  });

  test("컬럼 미상이면 이동만", () => {
    expect(cardMovedMessage("기능 A", null)).toBe("↔️ '기능 A' 카드를 이동");
  });

  test("제목 미상이면 일반화된 주어", () => {
    expect(cardMovedMessage(null, "진행 중")).toBe(
      "↔️ 카드를 '진행 중'(으)로 이동",
    );
  });
});

describe("cardUpdatedMessage", () => {
  test("변경 필드 라벨을 가운뎃점으로 연결", () => {
    expect(cardUpdatedMessage("작업 X", ["title", "priority"])).toBe(
      "✏️ '작업 X' — 제목·우선순위 수정",
    );
  });

  test("단일 필드", () => {
    expect(cardUpdatedMessage("작업 X", ["due_date"])).toBe(
      "✏️ '작업 X' — 마감일 수정",
    );
  });

  test("변경 필드를 못 추리면 일반화", () => {
    expect(cardUpdatedMessage("작업 X", [])).toBe("✏️ '작업 X' 카드 수정");
  });

  test("제목 미상이면 '카드' 주어로 폴백", () => {
    expect(cardUpdatedMessage(null, [])).toBe("✏️ 카드 카드 수정");
    expect(cardUpdatedMessage(null, ["description"])).toBe("✏️ 카드 — 설명 수정");
  });
});
