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
