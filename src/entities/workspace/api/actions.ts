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
  const { supabase } = await requireUser();

  // 워크스페이스 + 생성자 owner 멤버십을 원자적으로 생성한다.
  // 직접 insert + .select() 는 생성 직후 멤버가 없어 SELECT RLS 되읽기가
  // 막히므로(닭-달걀), SECURITY DEFINER RPC 로 처리한다. (0003 마이그레이션)
  const { data: id, error } = await supabase.rpc("create_workspace", {
    ws_name: name,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/workspaces");
  return id as string;
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
