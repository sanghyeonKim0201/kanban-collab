import { z } from "zod";

/**
 * FR-23: 회의록 구조화 결과 스키마.
 * LLM 응답(JSON)을 검증하고, 사람이 읽는 summary 와 함께
 * 참석자/안건/논의/결정사항/할 일로 분류한다.
 *
 * 하위 호환: actionItems 는 기존 {summary, actionItems} 형태와 동일한 모양을 유지한다.
 */

const actionItemSchema = z.object({
  title: z.string(),
  suggestedAssignee: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
});

/** 문자열 배열 — null/비문자 요소 제거 후 trim, 빈문자 제외 */
const stringList = z
  .array(z.unknown())
  .optional()
  .transform((arr) =>
    (arr ?? [])
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v !== ""),
  );

export const meetingSummarySchema = z.object({
  summary: z.string().default(""),
  attendees: stringList,
  agenda: stringList,
  discussion: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? v.trim() : "")),
  decisions: stringList,
  actionItems: z.array(actionItemSchema).default([]),
});

export type MeetingSummary = z.infer<typeof meetingSummarySchema>;

/**
 * LLM 응답 문자열에서 JSON 오브젝트를 추출해 구조화 스키마로 검증한다.
 * 코드펜스/잡텍스트를 제거하고 첫 JSON 오브젝트를 파싱한다.
 */
export function parseMeetingSummary(raw: string): MeetingSummary {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? raw;
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("회의록 추출 JSON 을 찾을 수 없습니다");
  return meetingSummarySchema.parse(JSON.parse(match[0]));
}

/**
 * 키 미설정 / 빈 transcript 시 결정적 휴리스틱 폴백.
 * LLM 과 동일한 형태({attendees, agenda, discussion, decisions, actionItems})를
 * 반환해 다운스트림이 분기 없이 동작하도록 한다.
 *
 * - summary: 앞부분 일부(280자)
 * - discussion: 원문 일부(최대 1000자)
 * - 나머지 구조화 필드는 빈 배열(휴리스틱으로 신뢰성 있게 뽑기 어려움)
 */
export function heuristicMeetingSummary(transcript: string): MeetingSummary {
  const trimmed = transcript.trim();
  return {
    summary: trimmed.slice(0, 280),
    attendees: [],
    agenda: [],
    discussion: trimmed.slice(0, 1000),
    decisions: [],
    actionItems: [],
  };
}
