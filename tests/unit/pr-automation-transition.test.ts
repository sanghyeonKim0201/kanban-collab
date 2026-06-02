import { describe, expect, test } from "vitest";
import {
  resolvePrTransition,
  pickTargetColumn,
  prBadgeState,
} from "@/features/pr-automation/model/transition";

describe("resolvePrTransition", () => {
  test("opened → open", () => {
    expect(resolvePrTransition("opened", false)).toBe("open");
  });
  test("reopened → open", () => {
    expect(resolvePrTransition("reopened", false)).toBe("open");
  });
  test("closed + merged → done", () => {
    expect(resolvePrTransition("closed", true)).toBe("done");
  });
  test("closed + 미머지 → null", () => {
    expect(resolvePrTransition("closed", false)).toBeNull();
  });
  test("synchronize/기타 → null", () => {
    expect(resolvePrTransition("synchronize", false)).toBeNull();
    expect(resolvePrTransition("edited", false)).toBeNull();
  });
});

describe("pickTargetColumn", () => {
  const board = {
    pr_automation_enabled: true,
    pr_open_column_id: "col-open",
    pr_merged_column_id: "col-done",
  };
  test("open 전이 → open 컬럼", () => {
    expect(pickTargetColumn(board, "open")).toBe("col-open");
  });
  test("done 전이 → merged 컬럼", () => {
    expect(pickTargetColumn(board, "done")).toBe("col-done");
  });
  test("비활성화 → null", () => {
    expect(pickTargetColumn({ ...board, pr_automation_enabled: false }, "open")).toBeNull();
  });
  test("매핑 null → null", () => {
    expect(pickTargetColumn({ ...board, pr_open_column_id: null }, "open")).toBeNull();
  });
  test("전이 null → null", () => {
    expect(pickTargetColumn(board, null)).toBeNull();
  });
});

describe("prBadgeState", () => {
  test("opened → open", () => {
    expect(prBadgeState("opened", false)).toBe("open");
  });
  test("closed + merged → merged", () => {
    expect(prBadgeState("closed", true)).toBe("merged");
  });
  test("closed + 미머지 → closed", () => {
    expect(prBadgeState("closed", false)).toBe("closed");
  });
});
