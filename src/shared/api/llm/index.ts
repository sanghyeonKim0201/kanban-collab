import "server-only";

import { serverEnv } from "@/shared/config/env";
import {
  parseClassification,
  type Classification,
} from "@/shared/lib/parse-llm-json";

const PROMPT = (title: string, description: string) =>
  `다음 작업을 [Bug, Feature, Refactor, Docs, Chore] 중 하나로 분류하고 ` +
  `우선순위(low/medium/high)를 JSON 형식으로만 출력하라. ` +
  `형식: {"category": "...", "priority": "...", "confidence": 0~1}\n\n` +
  `제목: ${title}\n설명: ${description || "(없음)"}`;

/** 키 미설정 시 결정적 휴리스틱 (개발/데모용) */
function heuristic(title: string, description: string): Classification {
  const t = `${title} ${description}`.toLowerCase();
  const category = /bug|fix|error|broken|crash/.test(t)
    ? "Bug"
    : /refactor|cleanup|rename/.test(t)
      ? "Refactor"
      : /doc|readme|guide/.test(t)
        ? "Docs"
        : /chore|bump|deps|config/.test(t)
          ? "Chore"
          : "Feature";
  const priority = /urgent|asap|critical|p0|high/.test(t)
    ? "high"
    : /minor|low|nice to have/.test(t)
      ? "low"
      : "medium";
  return { category, priority, confidence: 0.4 };
}

/** 비용/사용량 추적 훅 (명세 11 Sprint5 "호출 결과 캐싱 및 비용 추적 로그") */
function trackUsage(provider: string, promptChars: number) {
  console.info(
    `[llm] provider=${provider} prompt_chars=${promptChars} ts=${Date.now()}`,
  );
}

/** 명세 8.2: 카드 본문 → {category, priority, confidence} (추천만) */
export async function classifyTask(input: {
  title: string;
  description: string;
}): Promise<Classification> {
  const env = serverEnv();
  const prompt = PROMPT(input.title, input.description);

  if (!env.LLM_API_KEY) {
    trackUsage("stub", prompt.length);
    return heuristic(input.title, input.description);
  }

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
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const json = (await res.json()) as {
      content?: { text?: string }[];
    };
    return parseClassification(json.content?.[0]?.text ?? "");
  }

  // OpenAI 호환
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
  return parseClassification(json.choices?.[0]?.message?.content ?? "");
}
