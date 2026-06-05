"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/shared/api/supabase/server";
import { between } from "@/shared/lib/lexorank";
import type { Role } from "@/shared/types/database";
import {
  canManageMembers,
  isAssignableRole,
  wouldRemoveLastOwner,
  wouldRemoveLastOwnerByDeletion,
} from "@/entities/workspace/model/member-permissions";

const nameSchema = z.string().trim().min(1, "이름을 입력하세요").max(80);

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");
  return { supabase, user };
}

export async function createWorkspace(formData: FormData) {
  const name = nameSchema.parse(formData.get("name"));
  const { supabase, user } = await requireUser();

  const { data: ws, error } = await supabase
    .from("workspaces")
    .insert({ name })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: mErr } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });
  if (mErr) throw new Error(mErr.message);

  revalidatePath("/workspaces");
  return ws.id as string;
}

export async function createBoard(workspaceId: string, formData: FormData) {
  const name = nameSchema.parse(formData.get("name"));
  const { supabase } = await requireUser();

  const { data: board, error } = await supabase
    .from("boards")
    .insert({ workspace_id: workspaceId, name })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // 기본 컬럼 3개 (To Do / In Progress / Done) — lexorank 순서
  const p1 = between(null, null);
  const p2 = between(p1, null);
  const p3 = between(p2, null);
  const { error: cErr } = await supabase.from("columns").insert([
    { board_id: board.id, name: "To Do", position: p1 },
    { board_id: board.id, name: "In Progress", position: p2 },
    { board_id: board.id, name: "Done", position: p3 },
  ]);
  if (cErr) throw new Error(cErr.message);

  revalidatePath(`/workspaces/${workspaceId}`);
  return board.id as string;
}

// ── 멤버 관리 (명세 2.3 관리자: 팀원 초대/관리) ─────────────────────

const emailSchema = z
  .string()
  .trim()
  .min(1, "이메일을 입력하세요")
  .email("올바른 이메일 형식이 아닙니다");

/** 현재 유저의 워크스페이스 역할 — 권한 게이트용. 멤버 아니면 null. */
async function myWorkspaceRole(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  userId: string,
): Promise<Role | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as Role | undefined) ?? null;
}

/** 워크스페이스 전체 멤버의 (user_id, role) — 마지막 owner 보호 판정용. */
async function fetchMemberRoles(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<{ user_id: string; role: Role }[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    user_id: r.user_id as string,
    role: r.role as Role,
  }));
}

/**
 * FR: 이메일로 기존 가입 사용자를 멤버로 초대.
 * 권한·이메일 조회는 SECURITY DEFINER RPC(invite_member_by_email)가 담당.
 */
export async function inviteMember(
  workspaceId: string,
  email: string,
  role: Role,
) {
  const parsedEmail = emailSchema.parse(email);
  if (!isAssignableRole(role)) throw new Error("부여할 수 없는 역할입니다");
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("invite_member_by_email", {
    p_workspace_id: workspaceId,
    p_email: parsedEmail,
    p_role: role,
  });
  if (error) throw new Error(error.message);

  switch (data as string) {
    case "ok":
      break;
    case "forbidden":
      throw new Error("멤버를 초대할 권한이 없습니다");
    case "not_found":
      throw new Error("가입된 사용자가 아닙니다");
    case "already_member":
      throw new Error("이미 멤버입니다");
    case "bad_role":
      throw new Error("부여할 수 없는 역할입니다");
    default:
      throw new Error("초대에 실패했습니다");
  }

  revalidatePath(`/workspaces/${workspaceId}`);
}

/** FR: 멤버 역할 변경. owner/admin 만. 마지막 owner 강등 방지. */
export async function changeMemberRole(
  workspaceId: string,
  userId: string,
  role: Role,
) {
  if (!isAssignableRole(role)) throw new Error("부여할 수 없는 역할입니다");
  const { supabase, user } = await requireUser();

  const myRole = await myWorkspaceRole(supabase, workspaceId, user.id);
  if (!canManageMembers(myRole)) {
    throw new Error("멤버를 관리할 권한이 없습니다");
  }

  const roles = await fetchMemberRoles(supabase, workspaceId);
  const target = roles.find((r) => r.user_id === userId);
  if (!target) throw new Error("멤버를 찾을 수 없습니다");
  if (target.role === role) return; // 변경 없음 — no-op

  if (
    wouldRemoveLastOwner(
      roles.map((r) => r.role),
      target.role,
      role,
    )
  ) {
    throw new Error("마지막 소유자의 역할은 변경할 수 없습니다");
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  revalidatePath(`/workspaces/${workspaceId}`);
}

/** FR: 멤버 제거. owner/admin 만. 자기 자신·마지막 owner 제거 방지. */
export async function removeMember(workspaceId: string, userId: string) {
  const { supabase, user } = await requireUser();

  const myRole = await myWorkspaceRole(supabase, workspaceId, user.id);
  if (!canManageMembers(myRole)) {
    throw new Error("멤버를 관리할 권한이 없습니다");
  }
  if (userId === user.id) {
    throw new Error("자기 자신은 제거할 수 없습니다");
  }

  const roles = await fetchMemberRoles(supabase, workspaceId);
  const target = roles.find((r) => r.user_id === userId);
  if (!target) throw new Error("멤버를 찾을 수 없습니다");

  if (
    wouldRemoveLastOwnerByDeletion(
      roles.map((r) => r.role),
      target.role,
    )
  ) {
    throw new Error("마지막 소유자는 제거할 수 없습니다");
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  revalidatePath(`/workspaces/${workspaceId}`);
}
