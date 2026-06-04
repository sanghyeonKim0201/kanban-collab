"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/shared/api/supabase/auth";
import { getMyBoardRole } from "@/entities/board/api/role";

const repoSchema = z
  .string()
  .trim()
  .regex(/^[\w.-]+\/[\w.-]+$/, "owner/repo 형식이어야 합니다")
  .or(z.literal(""));

const boardNameSchema = z.string().trim().min(1, "이름을 입력하세요").max(100);

/** FR-01: 보드 이름 변경 — owner/admin 한정. */
export async function renameBoard(boardId: string, name: string) {
  const value = boardNameSchema.parse(name);
  const { supabase } = await requireUser();
  const role = await getMyBoardRole(boardId);
  if (role !== "owner" && role !== "admin") {
    throw new Error("권한이 없습니다 (owner/admin 만 변경 가능).");
  }
  const { error } = await supabase
    .from("boards")
    .update({ name: value })
    .eq("id", boardId);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}

/**
 * FR-01: 보드 삭제 — owner/admin 한정.
 * columns/cards 는 FK on delete cascade(마이그레이션 0001)로 자동 정리된다.
 */
export async function deleteBoard(boardId: string, workspaceId: string) {
  const { supabase } = await requireUser();
  const role = await getMyBoardRole(boardId);
  if (role !== "owner" && role !== "admin") {
    throw new Error("권한이 없습니다 (owner/admin 만 삭제 가능).");
  }
  const { error } = await supabase.from("boards").delete().eq("id", boardId);
  if (error) throw new Error(error.message);
  revalidatePath(`/workspaces/${workspaceId}`);
}

/** 명세 8.1-1: 보드 설정에서 GitHub 저장소 연결 → boards.github_repo 저장 */
export async function setBoardRepo(boardId: string, repo: string) {
  const value = repoSchema.parse(repo);
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("boards")
    .update({ github_repo: value || null })
    .eq("id", boardId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function setPrAutomation(input: {
  boardId: string;
  enabled: boolean;
  openColumnId: string | null;
  mergedColumnId: string | null;
}) {
  const { supabase } = await requireUser();
  const role = await getMyBoardRole(input.boardId);
  if (role !== "owner" && role !== "admin") {
    throw new Error("권한이 없습니다 (owner/admin 만 설정 가능).");
  }
  const { error } = await supabase
    .from("boards")
    .update({
      pr_automation_enabled: input.enabled,
      pr_open_column_id: input.openColumnId,
      pr_merged_column_id: input.mergedColumnId,
    })
    .eq("id", input.boardId);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${input.boardId}`);
}
