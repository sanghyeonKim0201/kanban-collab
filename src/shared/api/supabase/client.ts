"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/shared/config/env";

/** 클라이언트 컴포넌트 전용 Supabase 클라이언트 */
export function createClient() {
  const env = publicEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
