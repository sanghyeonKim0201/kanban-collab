import "server-only";

import { createClient } from "@/shared/api/supabase/server";
import type {
  Board,
  Role,
  Workspace,
  UserProfile,
} from "@/shared/types/database";

export interface WorkspaceListItem extends Workspace {
  role: Role;
}

export async function listMyWorkspaces(): Promise<WorkspaceListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, created_at)")
    .order("created_at", { referencedTable: "workspaces", ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => row.workspaces)
    .map((row) => {
      const ws = row.workspaces as unknown as Workspace;
      return { ...ws, role: row.role as Role };
    });
}

export interface WorkspaceListItemWithCounts extends WorkspaceListItem {
  boardCount: number;
  memberCount: number;
}

/** 목록 카드용: 워크스페이스 + 보드/멤버 수 (읽기 전용 집계). */
export async function listMyWorkspacesWithCounts(): Promise<
  WorkspaceListItemWithCounts[]
> {
  const workspaces = await listMyWorkspaces();
  if (workspaces.length === 0) return [];
  const supabase = createClient();

  return Promise.all(
    workspaces.map(async (ws) => {
      const [{ count: boardCount }, { count: memberCount }] = await Promise.all([
        supabase
          .from("boards")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", ws.id),
        supabase
          .from("workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", ws.id),
      ]);
      return {
        ...ws,
        boardCount: boardCount ?? 0,
        memberCount: memberCount ?? 0,
      };
    }),
  );
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function listBoards(workspaceId: string): Promise<Board[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface MemberRow {
  role: Role;
  user: UserProfile;
}

export async function listMembers(workspaceId: string): Promise<MemberRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, user_profiles(id, email, display_name, avatar_url)")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((r) => r.user_profiles)
    .map((r) => ({
      role: r.role as Role,
      user: r.user_profiles as unknown as UserProfile,
    }));
}
