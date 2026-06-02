import "server-only";
import { createClient } from "@/shared/api/supabase/server";
import type { Role } from "@/shared/types/database";

/** 현재 유저의 이 보드(워크스페이스) 역할. 멤버 아니면 null. */
export async function getMyBoardRole(boardId: string): Promise<Role | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: board } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .maybeSingle();
  if (!board) return null;

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", board.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  return (member?.role as Role | undefined) ?? null;
}
