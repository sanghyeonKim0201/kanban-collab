import "server-only";

import { createClient } from "@/shared/api/supabase/server";
import type {
  Card,
  Label,
  Role,
  UserProfile,
} from "@/shared/types/database";
import { listLabels } from "@/entities/label/api/queries";
import { listComments, type CommentWithAuthor } from "./comments";

export interface CardDetail {
  card: Card;
  boardId: string;
  workspaceId: string;
  currentUserId: string | null;
  assignees: UserProfile[];
  labels: Label[];
  boardLabels: Label[];
  members: { role: Role; user: UserProfile }[];
  comments: CommentWithAuthor[];
}

export async function getCardDetail(
  cardId: string,
): Promise<CardDetail | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: card } = await supabase
    .from("cards")
    .select(
      "*, columns(board_id, boards(id, workspace_id)), card_assignees(user_profiles(id, email, display_name, avatar_url)), card_labels(labels(*))",
    )
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return null;

  const c = card as unknown as Card & {
    columns: { board_id: string; boards: { workspace_id: string } } | null;
    card_assignees: { user_profiles: UserProfile | null }[];
    card_labels: { labels: Label | null }[];
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
      created_by: c.created_by,
      created_at: c.created_at,
      updated_at: c.updated_at,
    },
    boardId,
    workspaceId,
    currentUserId: user?.id ?? null,
    assignees: c.card_assignees
      .map((a) => a.user_profiles)
      .filter((u): u is UserProfile => !!u),
    labels: c.card_labels
      .map((l) => l.labels)
      .filter((l): l is Label => !!l),
    boardLabels: await listLabels(boardId),
    members,
    comments,
  };
}
