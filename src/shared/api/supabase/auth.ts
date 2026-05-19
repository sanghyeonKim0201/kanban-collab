import "server-only";

import { createClient } from "./server";

/** 명세 9.1: 모든 Server Action 진입점에서 auth.uid() 확인 */
export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");
  return { supabase, user };
}
