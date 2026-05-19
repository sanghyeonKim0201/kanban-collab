import { describe, expect, test } from "vitest";
import { parseClassification } from "@/shared/lib/parse-llm-json";

describe("parseClassification (명세 8.2 LLM JSON 파싱)", () => {
  test("순수 JSON", () => {
    const r = parseClassification(
      '{"category":"Bug","priority":"high","confidence":0.9}',
    );
    expect(r).toEqual({ category: "Bug", priority: "high", confidence: 0.9 });
  });

  test("코드펜스 + 잡텍스트 제거", () => {
    const r = parseClassification(
      'Sure!\n```json\n{"category":"Feature","priority":"medium","confidence":0.7}\n```\n',
    );
    expect(r.category).toBe("Feature");
    expect(r.priority).toBe("medium");
  });

  test("잘못된 category → 에러", () => {
    expect(() =>
      parseClassification('{"category":"Unknown","priority":"low","confidence":1}'),
    ).toThrow();
  });

  test("confidence 범위 밖 → 에러", () => {
    expect(() =>
      parseClassification('{"category":"Chore","priority":"low","confidence":2}'),
    ).toThrow();
  });

  test("JSON 아님 → 에러", () => {
    expect(() => parseClassification("no json at all")).toThrow();
  });
});
