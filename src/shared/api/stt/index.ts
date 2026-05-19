import "server-only";

import { serverEnv } from "@/shared/config/env";

/**
 * 명세 8.3-2: 음성 → 텍스트 (Whisper 등).
 * 키 미설정 시 스텁(빈 transcript) — 텍스트 회의록은 STT 없이 동작.
 */
export async function transcribeAudio(
  audio: Blob,
  filename: string,
): Promise<string> {
  const env = serverEnv();
  if (!env.STT_API_KEY) {
    console.info("[stt] STT_API_KEY 미설정 — 스텁 응답");
    return "";
  }

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-1");

  const res = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { authorization: `Bearer ${env.STT_API_KEY}` },
      body: form,
    },
  );
  if (!res.ok) throw new Error(`STT 실패: ${res.status}`);
  const json = (await res.json()) as { text?: string };
  return json.text ?? "";
}
