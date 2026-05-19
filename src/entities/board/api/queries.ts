import "server-only";

import { createClient } from "@/shared/api/supabase/server";
import type {
  Board,
  BoardWithColumns,
  Card,
  CardWithRelations,
  Column,
  Label,
  UserProfile,
} from "@/shared/types/database";

export async function listAllMyBoards(): Promise<Board[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBoard(boardId: string): Promise<Board | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .maybeSingle();
  return data;
}

/**
 * 보드 전체(컬럼 position 정렬, 카드 position 정렬, 담당자/라벨 조인).
 * 명세 10.1: 초기 페인트 단축을 위해 RSC 에서 1회 조회.
 */
export async function getBoardWithColumnsAndCards(
  boardId: string,
): Promise<BoardWithColumns | null> {
  const supabase = createClient();

  const { data: board } = await supabase
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .maybeSingle();
  if (!board) return null;

  const { data: columns } = await supabase
    .from("columns")
    .select("*")
    .eq("board_id", boardId)
    .order("position", { ascending: true });

  const columnIds = (columns ?? []).map((c: Column) => c.id);

  const { data: cards } = columnIds.length
    ? await supabase
        .from("cards")
        .select(
          "*, card_assignees(user_profiles(id, email, display_name, avatar_url)), card_labels(labels(*))",
        )
        .in("column_id", columnIds)
        .order("position", { ascending: true })
    : { data: [] as unknown[] };

  const cardsByColumn = new Map<string, CardWithRelations[]>();
  for (const raw of (cards ?? []) as Record<string, unknown>[]) {
    const card = raw as unknown as Card & {
      card_assignees: { user_profiles: UserProfile | null }[];
      card_labels: { labels: Label | null }[];
    };
    const enriched: CardWithRelations = {
      id: card.id,
      column_id: card.column_id,
      title: card.title,
      description: card.description,
      position: card.position,
      priority: card.priority,
      due_date: card.due_date,
      ai_category: card.ai_category,
      github_url: card.github_url,
      created_by: card.created_by,
      created_at: card.created_at,
      updated_at: card.updated_at,
      assignees: card.card_assignees
        .map((a) => a.user_profiles)
        .filter((u): u is UserProfile => !!u),
      labels: card.card_labels
        .map((l) => l.labels)
        .filter((l): l is Label => !!l),
    };
    const list = cardsByColumn.get(card.column_id) ?? [];
    list.push(enriched);
    cardsByColumn.set(card.column_id, list);
  }

  return {
    ...board,
    columns: (columns ?? []).map((col: Column) => ({
      ...col,
      cards: cardsByColumn.get(col.id) ?? [],
    })),
  };
}
