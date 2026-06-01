import { describe, it, expect } from "vitest";
import { buildSparkline } from "@/shared/lib/sparkline-path";

describe("buildSparkline", () => {
  it("빈 배열이면 빈 path 를 반환", () => {
    const r = buildSparkline([], 100, 30);
    expect(r.line).toBe("");
    expect(r.area).toBe("");
  });

  it("단일 값이면 수평선", () => {
    const r = buildSparkline([5], 100, 30);
    expect(r.line).toContain("M0");
  });

  it("증가 데이터는 우상향 (마지막 점 y가 첫 점 y보다 작음)", () => {
    const r = buildSparkline([0, 10], 100, 30);
    const pts = r.points;
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    expect(first.x).toBe(0);
    expect(last.x).toBe(100);
    expect(last.y).toBeLessThan(first.y);
  });

  it("area path 는 닫힌 도형 (Z 포함)", () => {
    const r = buildSparkline([1, 2, 3], 100, 30);
    expect(r.area.endsWith("Z")).toBe(true);
  });
});
