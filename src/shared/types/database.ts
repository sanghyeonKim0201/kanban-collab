/**
 * 명세 5장 ERD 기반 DB 타입 (supabase gen types 대체용 수기 정의).
 * 마이그레이션 0001/0002 와 1:1 대응.
 */

export type Role = "owner" | "admin" | "member" | "guest";
export type Priority = "low" | "medium" | "high";
export type MeetingStatus = "pending" | "done";

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  github_repo: string | null;
  created_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: string;
  created_at: string;
}

export interface Card {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: string;
  priority: Priority;
  due_date: string | null;
  ai_category: string | null;
  github_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardAssignee {
  id: string;
  card_id: string;
  user_id: string;
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface CardLabel {
  id: string;
  card_id: string;
  label_id: string;
}

export interface Comment {
  id: string;
  card_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  workspace_id: string;
  title: string;
  audio_url: string | null;
  transcript: string | null;
  summary: string | null;
  status: MeetingStatus;
  created_at: string;
}

export interface MeetingActionItem {
  id: string;
  meeting_id: string;
  card_id: string | null;
  title: string;
  suggested_assignee: string | null;
}

export interface GithubEvent {
  id: string;
  board_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/** 조인 결과 합성 타입 */
export interface CardWithRelations extends Card {
  assignees: UserProfile[];
  labels: Label[];
}

export interface ColumnWithCards extends Column {
  cards: CardWithRelations[];
}

export interface BoardWithColumns extends Board {
  columns: ColumnWithCards[];
}
