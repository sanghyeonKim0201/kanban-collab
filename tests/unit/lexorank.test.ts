import { describe, expect, test } from "vitest";
import { between, first, last } from "@/shared/lib/lexorank";

describe("lexorank", () => {
  test("first < last", () => {
    expect(first() < last()).toBe(true);
  });

  test("between two ranks yields a value strictly inside", () => {
    const a = first();
    const b = last();
    const mid = between(a, b);
    expect(a < mid && mid < b).toBe(true);
  });

  test("repeated insertion at head never collides", () => {
    let hi = last();
    const lo = first();
    for (let i = 0; i < 100; i++) {
      const m = between(lo, hi);
      expect(m > lo).toBe(true);
      expect(m < hi).toBe(true);
      hi = m;
    }
  });

  test("repeated insertion at tail never collides", () => {
    let lo = first();
    const hi = last();
    for (let i = 0; i < 100; i++) {
      const m = between(lo, hi);
      expect(m > lo && m < hi).toBe(true);
      lo = m;
    }
  });

  test("between(null, null) returns a midpoint for empty list", () => {
    const only = between(null, null);
    expect(only > first()).toBe(true);
    expect(only < last()).toBe(true);
  });

  test("appending after a value (between(x, null))", () => {
    const a = between(null, null);
    const b = between(a, null);
    expect(b > a).toBe(true);
  });

  test("prepending before a value (between(null, x))", () => {
    const a = between(null, null);
    const b = between(null, a);
    expect(b < a).toBe(true);
  });
});
