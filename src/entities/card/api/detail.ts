import "server-only";

import { createClient } from "@/shared/api/supabase/server";
import type {
  Card,
  Role,
  UserProfile,
} from "@/shared/types/database";
import { listComments, type CommentWithAuthor } from "./comments";

export interface CardDetail {
  card: Card;
  boardId: string;
  workspaceId: string;
  assignees: UserProfile[];
  members: { role: Role; user: UserProfile }[];
  comments: CommentWithAuthor[];
}

export async function getCardDetail(
  cardId: string,
): Promise<CardDetail | null> {
  const supabase = createClient();

  const { data: card } = await supabase
    .from("cards")
    .select(
      // boards 임베드는 FK 를 명시한다. boards 가 pr_open_column_id/pr_merged_column_id 로
      // columns 를 역참조하면서 columns↔boards 관계가 다중이 되어, 명시하지 않으면
      // PostgREST PGRST201("more than one relationship") 로 카드 상세가 깨진다.
      "*, columns(board_id, boards!columns_board_id_fkey(id, workspace_id)), card_assignees(user_profiles(id, email, display_name, avatar_url))",
    )
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return null;

  const c = card as unknown as Card & {
    columns: { board_id: string; boards: { workspace_id: string } } | null;
    card_assignees: { user_profiles: UserProfile | null }[];
  };
  const boardId = c.columns?.board_id ?? "";
  const workspaceId = c.columns?.boards?.workspace_id ?? "";

  const { data: memberRows } = await supabase
    .from("workspace_members")
    .select("role, user_profiles(id, email, display_name, avatar_url)")
    .eq("workspace_id", workspaceId);

  const members = (memberRows ?? [])
    .filter((m) => m.user_profiles)
    .map((m) => ({
      role: m.role as Role,
      user: m.user_profiles as unknown as UserProfile,
    }));

  const comments = await listComments(cardId);

  return {
    card: {
      id: c.id,
      column_id: c.column_id,
      title: c.title,
      description: c.description,
      position: c.position,
      priority: c.priority,
      due_date: c.due_date,
      ai_category: c.ai_category,
      github_url: c.github_url,
      github_pr_state: c.github_pr_state,
      created_by: c.created_by,
      created_at: c.created_at,
      updated_at: c.updated_at,
    },
    boardId,
    workspaceId,
    assignees: c.card_assignees
      .map((a) => a.user_profiles)
      .filter((u): u is UserProfile => !!u),
    members,
    comments,
  };
}
