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
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().optional().default(""),
  LLM_PROVIDER: z.enum(["openai", "anthropic"]).optional().default("openai"),
  LLM_API_KEY: z.string().optional().default(""),
  LLM_MODEL: z.string().optional().default("gpt-4o-mini"),
  STT_API_KEY: z.string().optional().default(""),
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
    STT_API_KEY: process.env.STT_API_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `[env] 서버 환경변수가 없습니다 (SUPABASE_SERVICE_ROLE_KEY 필수).\n${parsed.error.message}`,
    );
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
