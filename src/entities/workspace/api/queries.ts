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
