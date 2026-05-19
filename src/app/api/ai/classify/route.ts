import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/api/supabase/server";
import { classifyTask } from "@/shared/api/llm";

export const runtime = "nodejs";

const bodySchema = z.object({ cardId: z.string().uuid() });

/**
 * 명세 6.2 / 8.2: 카드 본문 → 카테고리/우선순위 추천.
 * cards.ai_category 만 갱신(추천). 우선순위 자동 적용은 하지 않음
 * (명세 8.2 설계 결정: 항상 추천, 적용/거부는 사용자).
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

  const { data: card } = await supabase
    .from("cards")
    .select("id, title, description")
    .eq("id", parsed.data.cardId)
    .maybeSingle();
  if (!card) {
    return NextResponse.json({ error: "card not found" }, { status: 404 });
  }

  let result;
  try {
    result = await classifyTask({
      title: card.title,
      description: card.description ?? "",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "분류 실패" },
      { status: 502 },
    );
  }

  // 추천만 저장 (우선순위는 사용자가 적용 버튼으로 반영)
  await supabase
    .from("cards")
    .update({ ai_category: result.category })
    .eq("id", card.id);

  return NextResponse.json(result);
}
