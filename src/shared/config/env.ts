import { z } from "zod";

/**
 * 명세 10.2: 환경변수 분리. 필수값은 사용 시점에 검증하여
 * (빌드 타임이 아닌 런타임) 누락 시 명확한 에러를 던진다.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  // 관리자(RLS 우회) 작업에만 필요 — GitHub Webhook 등. AI/회의 경로는 불필요하므로
  // 선택값으로 두고, 실제 사용처(createAdminClient)에서 누락 시 명확히 에러를 던진다.
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  GITHUB_WEBHOOK_SECRET: z.string().optional().default(""),
  LLM_PROVIDER: z.enum(["openai", "anthropic"]).optional().default("openai"),
  LLM_API_KEY: z.string().optional().default(""),
  LLM_MODEL: z.string().optional().default("gpt-4o-mini"),
  // OpenAI 호환 엔드포인트면 base URL 만 바꿔 로컬(Ollama)·Groq·Gemini 로 스왑 가능.
  LLM_BASE_URL: z.string().url().optional().default("https://api.openai.com/v1"),
  STT_API_KEY: z.string().optional().default(""),
  STT_BASE_URL: z.string().url().optional().default("https://api.openai.com/v1"),
  STT_MODEL: z.string().optional().default("whisper-1"),
});

let publicCache: z.infer<typeof publicSchema> | null = null;
let serverCache: z.infer<typeof serverSchema> | null = null;

export function publicEnv() {
  if (publicCache) return publicCache;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!parsed.success) {
    throw new Error(
      `[env] Supabase 공개 환경변수가 없습니다. .env.local 을 설정하세요.\n${parsed.error.message}`,
    );
  }
  publicCache = parsed.data;
  return publicCache;
}

export function serverEnv() {
  if (serverCache) return serverCache;
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    STT_API_KEY: process.env.STT_API_KEY,
    STT_BASE_URL: process.env.STT_BASE_URL,
    STT_MODEL: process.env.STT_MODEL,
  });
  if (!parsed.success) {
    throw new Error(`[env] 서버 환경변수 파싱 실패.\n${parsed.error.message}`);
  }
  serverCache = parsed.data;
  return serverCache;
}

export function isSupabaseConfigured() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
