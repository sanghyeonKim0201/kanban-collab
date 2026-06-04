import "server-only";

import { serverEnv } from "@/shared/config/env";
import { z } from "zod";
import {
  parseClassification,
  type Classification,
} from "@/shared/lib/parse-llm-json";
import {
  bumpPriorityForDueDate,
  heuristicAssigneeName,
} from "@/shared/lib/ai-classify-logic";

/** FR-22: 같은 보드의 과거 확정 분류 예시(few-shot) */
export interface ClassifyExample {
  title: string;
  category: string | null;
  priority: string;
}

const meetingSchema = z.object({
  summary: z.string(),
  actionItems: z.array(
    z.object({
      title: z.string(),
      suggestedAssignee: z.string().nullable().optional(),
    }),
  ),
});
export type MeetingExtract = z.infer<typeof meetingSchema>;

interface PromptInput {
  title: string;
  description: string;
  dueDate?: string | null;
  /** 추천 후보 멤버 이름 목록(FR-21) */
  memberNames: string[];
  /** 과거 확정 분류 예시(FR-22) */
  examples: ClassifyExample[];
}

const PROMPT = ({
  title,
  description,
  dueDate,
  memberNames,
  examples,
}: PromptInput) => {
  const lines = [
    `다음 작업을 [Bug, Feature, Refactor, Docs, Chore] 중 하나로 분류하고 ` +
      `우선순위(low/medium/high)와 가장 적합한 담당자 1명을 JSON 형식으로만 출력하라.`,
    `형식: {"category":"...","priority":"...","confidence":0~1,"suggestedAssignee":"이름 또는 null"}`,
    // 마감 임박 상향은 후처리(bumpPriorityForDueDate)가 결정적으로 담당하므로
    // LLM 에는 내용 기반 우선순위만 요청한다(이중 상향 방지). 마감일은 참고용으로만 제공.
    `규칙: 우선순위는 작업 내용의 긴급도·중요도로만 판단하라(마감일은 시스템이 별도 반영). ` +
      `담당자는 아래 멤버 목록에서만 고르고, 적합한 사람이 없으면 null 로 두라.`,
  ];

  if (examples.length > 0) {
    lines.push(
      `\n[과거 분류 예시 — 팀이 최종 확정한 결과이니 일관되게 따르라]`,
      ...examples.map(
        (e) =>
          `- "${e.title}" → category=${e.category ?? "?"}, priority=${e.priority}`,
      ),
    );
  }

  lines.push(
    `\n[멤버 목록] ${memberNames.length > 0 ? memberNames.join(", ") : "(없음)"}`,
    `\n제목: ${title}`,
    `설명: ${description || "(없음)"}`,
    `마감일: ${dueDate ?? "(없음)"}`,
  );
  return lines.join("\n");
};

/** 키 미설정 시 결정적 휴리스틱 (개발/데모용) */
function heuristic(input: {
  title: string;
  description: string;
  dueDate?: string | null;
  memberNames: string[];
}): Classification {
  const t = `${input.title} ${input.description}`.toLowerCase();
  const category = /bug|fix|error|broken|crash/.test(t)
    ? "Bug"
    : /refactor|cleanup|rename/.test(t)
      ? "Refactor"
      : /doc|readme|guide/.test(t)
        ? "Docs"
        : /chore|bump|deps|config/.test(t)
          ? "Chore"
          : "Feature";
  const basePriority = /urgent|asap|critical|p0|high/.test(t)
    ? "high"
    : /minor|low|nice to have/.test(t)
      ? "low"
      : "medium";
  // FR-20: 마감 임박 시 휴리스틱 폴백도 우선순위 상향.
  const priority = bumpPriorityForDueDate(basePriority, input.dueDate);
  return {
    category,
    priority,
    confidence: 0.4,
    // FR-21: 결정적 단순 규칙(첫 멤버) — 멤버 없으면 null.
    suggestedAssignee: heuristicAssigneeName(
      input.memberNames.map((name) => ({ id: name, name })),
    ),
  };
}

/** 비용/사용량 추적 훅 (명세 11 Sprint5 "호출 결과 캐싱 및 비용 추적 로그") */
function trackUsage(provider: string, promptChars: number) {
  console.info(
    `[llm] provider=${provider} prompt_chars=${promptChars} ts=${Date.now()}`,
  );
}

/** provider 추상화된 단일 프롬프트 호출 (키 필요) */
async function callLLM(prompt: string, maxTokens: number): Promise<string> {
  const env = serverEnv();
  trackUsage(env.LLM_PROVIDER, prompt.length);

  if (env.LLM_PROVIDER === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.LLM_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const json = (await res.json()) as { content?: { text?: string }[] };
    return json.content?.[0]?.text ?? "";
  }

  const res = await fetch(`${env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

/**
 * 명세 8.2 / FR-20·21·22: 카드 본문 → {category, priority, confidence, suggestedAssignee} (추천만).
 * - dueDate 를 고려해 우선순위 산출(FR-20).
 * - members(이름)에서 담당자 1명 추천(FR-21).
 * - examples(과거 확정 분류)를 few-shot 으로 주입(FR-22).
 */
export async function classifyTask(input: {
  title: string;
  description: string;
  dueDate?: string | null;
  memberNames?: string[];
  examples?: ClassifyExample[];
}): Promise<Classification> {
  const env = serverEnv();
  const memberNames = input.memberNames ?? [];
  const examples = input.examples ?? [];

  if (!env.LLM_API_KEY) {
    const fallback = heuristic({
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      memberNames,
    });
    trackUsage("stub", input.title.length + input.description.length);
    return fallback;
  }

  const prompt = PROMPT({
    title: input.title,
    description: input.description,
    dueDate: input.dueDate,
    memberNames,
    examples,
  });
  const parsed = parseClassification(await callLLM(prompt, 250));
  // FR-20: LLM 응답이 마감일을 무시했을 수 있으니 결정적으로 한 번 더 보정.
  return {
    ...parsed,
    priority: bumpPriorityForDueDate(parsed.priority, input.dueDate),
  };
}

/** 명세 8.3-3: transcript → 요약 + action items */
export async function summarizeMeeting(
  transcript: string,
): Promise<MeetingExtract> {
  const env = serverEnv();
  if (!env.LLM_API_KEY || !transcript.trim()) {
    trackUsage("stub", transcript.length);
    return {
      summary: transcript.slice(0, 280),
      actionItems: [],
    };
  }
  const prompt =
    `다음 회의록을 한국어로 3~5문장 요약하고, 실행 가능한 작업(action items)을 ` +
    `추출하라. JSON 형식으로만 출력: ` +
    `{"summary":"...","actionItems":[{"title":"...","suggestedAssignee":null}]}\n\n` +
    transcript;
  const raw = await callLLM(prompt, 800);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("회의록 추출 JSON 파싱 실패");
  return meetingSchema.parse(JSON.parse(match[0]));
}
