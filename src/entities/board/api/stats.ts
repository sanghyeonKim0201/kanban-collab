import "server-only";
import { createClient } from "@/shared/api/supabase/server";

/** 워크스페이스의 보드/회의 수 (대시보드 카운터용, 읽기 전용). */
export async function getWorkspaceCounts(workspaceId: string): Promise<{
  boards: number;
  meetings: number;
}> {
  const supabase = createClient();
  const [{ count: boards }, { count: meetings }] = await Promise.all([
    supabase.from("boards").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);
  return { boards: boards ?? 0, meetings: meetings ?? 0 };
}
