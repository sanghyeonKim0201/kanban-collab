"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/shared/api/supabase/server";
import { between } from "@/shared/lib/lexorank";

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
