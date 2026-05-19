import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/shared/config/env";

/**
 * service_role 클라이언트. RLS 우회 — Route Handler 의 Webhook/AI 처리
 * 등 시스템 작업에만 사용. 절대 클라이언트 번들에 포함 금지.
 */
export function createAdminClient() {
  const pub = publicEnv();
  const srv = serverEnv();
  return createSupabaseClient(
    pub.NEXT_PUBLIC_SUPABASE_URL,
    srv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
