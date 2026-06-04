import { z } from "zod";

export const CATEGORIES = [
  "Bug",
  "Feature",
  "Refactor",
  "Docs",
  "Chore",
] as const;

export const classificationSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  // FR-21: 추천 담당자 이름. 기존 응답과 호환되도록 optional·nullable.
  // null/undefined/빈문자 모두 "추천 없음"으로 정규화한다.
  suggestedAssignee: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
});

export type Classification = z.infer<typeof classificationSchema>;

/**
 * 명세 8.2: LLM 응답에서 JSON 추출 → 검증.
 * 코드펜스/잡텍스트를 제거하고 첫 번째 JSON 오브젝트를 파싱한다.
 */
export function parseClassification(raw: string): Classification {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? raw;
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM 응답에서 JSON 을 찾을 수 없습니다");
  return classificationSchema.parse(JSON.parse(match[0]));
}
