import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/api/supabase/server";
import { classifyTask, type ClassifyExample } from "@/shared/api/llm";
import { matchAssignee } from "@/shared/lib/ai-classify-logic";

export const runtime = "nodejs";

const bodySchema = z.object({ cardId: z.string().uuid() });

/** FR-22: few-shot 으로 주입할 과거 확정 분류 카드 수 상한. */
const EXAMPLE_LIMIT = 5;

interface ClassifyResponse {
  category: string;
  priority: "low" | "medium" | "high";
  confidence: number;
  /** FR-21: 추천 담당자(멤버 매칭 결과). 없으면 null. */
  suggestedAssignee: { id: string; name: string | null } | null;
}

type Supabase = ReturnType<typeof createClient>;

/** FR-21: 워크스페이스 멤버(담당자 후보) 조회. error 는 문자열로 표면화. */
async function fetchMembers(
  supabase: Supabase,
  workspaceId: string,
): Promise<{ members: { id: string; name: string | null }[]; error?: string }> {
  if (!workspaceId) return { members: [] };
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_profiles(id, display_name, email)")
    .eq("workspace_id", workspaceId);
  if (error) return { members: [], error: error.message };
  const rows = (data ?? []) as unknown as {
    user_profiles: {
      id: string;
      display_name: string | null;
      email: string | null;
    } | null;
  }[];
  const members: { id: string; name: string | null }[] = [];
  for (const row of rows) {
    const p = row.user_profiles;
    if (p) members.push({ id: p.id, name: p.display_name ?? p.email });
  }
  return { members };
}

/** FR-22: 같은 보드의 최근 분류 카드(ai_category 가 있는)들을 few-shot 예시로. */
async function fetchExamples(
  supabase: Supabase,
  boardId: string,
  excludeCardId: string,
): Promise<{ examples: ClassifyExample[]; error?: string }> {
  if (!boardId) return { examples: [] };
  const { data: columnRows, error: colErr } = await supabase
    .from("columns")
    .select("id")
    .eq("board_id", boardId);
  if (colErr) return { examples: [], error: colErr.message };
  const columnIds = (columnRows ?? []).map((r) => (r as { id: string }).id);
  if (columnIds.length === 0) return { examples: [] };

  const { data: exampleRows, error: exErr } = await supabase
    .from("cards")
    .select("title, ai_category, priority")
    .in("column_id", columnIds)
    .not("ai_category", "is", null)
    .neq("id", excludeCardId)
    .order("updated_at", { ascending: false })
    .limit(EXAMPLE_LIMIT);
  if (exErr) return { examples: [], error: exErr.message };

  const examples: ClassifyExample[] = [];
  for (const row of exampleRows ?? []) {
    const r = row as {
      title: string;
      ai_category: string | null;
      priority: string;
    };
    examples.push({
      title: r.title,
      category: r.ai_category,
      priority: r.priority,
    });
  }
  return { examples };
}

/**
 * 명세 6.2 / 8.2 + FR-20·21·22: 카드 본문·마감일 → 카테고리/우선순위/담당자 추천.
 * cards.ai_category 만 갱신(추천). 우선순위·담당자 적용은 사용자 "적용" 경로(UI)로
 * 처리한다(명세 8.2: 항상 추천, 자동 덮어쓰기 금지).
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // 카드 본문 + 마감일 + 소속 컬럼/보드/워크스페이스(멤버·few-shot 조회용).
  const { data: card, error: cardErr } = await supabase
    .from("cards")
    .select(
      "id, title, description, due_date, column_id, " +
        "columns(board_id, boards!columns_board_id_fkey(workspace_id))",
    )
    .eq("id", parsed.data.cardId)
    .maybeSingle();
  if (cardErr) {
    return NextResponse.json({ error: cardErr.message }, { status: 500 });
  }
  if (!card) {
    return NextResponse.json({ error: "card not found" }, { status: 404 });
  }

  const c = card as unknown as {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    column_id: string;
    columns: { board_id: string; boards: { workspace_id: string } | null } | null;
  };
  const boardId = c.columns?.board_id ?? "";
  const workspaceId = c.columns?.boards?.workspace_id ?? "";

  // 멤버 조회(FR-21)와 few-shot 예시 조회(FR-22)는 서로 독립 → 병렬 실행(워터폴 제거).
  const [membersRes, examplesRes] = await Promise.all([
    fetchMembers(supabase, workspaceId),
    fetchExamples(supabase, boardId, c.id),
  ]);
  if (membersRes.error) {
    return NextResponse.json({ error: membersRes.error }, { status: 500 });
  }
  if (examplesRes.error) {
    return NextResponse.json({ error: examplesRes.error }, { status: 500 });
  }
  const members = membersRes.members;
  const examples = examplesRes.examples;

  let result;
  try {
    result = await classifyTask({
      title: c.title,
      description: c.description ?? "",
      dueDate: c.due_date,
      memberNames: members
        .map((m) => m.name)
        .filter((n): n is string => !!n && n.trim() !== ""),
      examples,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "분류 실패" },
      { status: 502 },
    );
  }

  // FR-21: 추천 이름 → 멤버 id 매핑(존재하는 멤버만).
  const matchedId = matchAssignee(result.suggestedAssignee, members);
  const suggestedAssignee = matchedId
    ? { id: matchedId, name: members.find((m) => m.id === matchedId)?.name ?? null }
    : null;

  // 추천만 저장 (우선순위·담당자는 사용자가 적용 버튼으로 반영).
  const { error: updateErr } = await supabase
    .from("cards")
    .update({ ai_category: result.category })
    .eq("id", c.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const response: ClassifyResponse = {
    category: result.category,
    priority: result.priority,
    confidence: result.confidence,
    suggestedAssignee,
  };
  return NextResponse.json(response);
}
