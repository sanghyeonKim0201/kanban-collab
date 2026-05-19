import "server-only";

import { createClient } from "@/shared/api/supabase/server";
import type {
  Meeting,
  MeetingActionItem,
} from "@/shared/types/database";

export async function listMeetings(): Promise<Meeting[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface MeetingDetail {
  meeting: Meeting;
  actionItems: MeetingActionItem[];
  targets: {
    boardId: string;
    boardName: string;
    columns: { id: string; name: string }[];
  }[];
}

export async function getMeetingDetail(
  meetingId: string,
): Promise<MeetingDetail | null> {
  const supabase = createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting) return null;

  const { data: actionItems } = await supabase
    .from("meeting_action_items")
    .select("*")
    .eq("meeting_id", meetingId);

  const { data: boards } = await supabase
    .from("boards")
    .select("id, name, columns(id, name, position)")
    .eq("workspace_id", meeting.workspace_id);

  const targets = (boards ?? []).map(
    (b: { id: string; name: string; columns: { id: string; name: string; position: string }[] }) => ({
      boardId: b.id,
      boardName: b.name,
      columns: [...b.columns]
        .sort((x, y) => (x.position < y.position ? -1 : 1))
        .map((c) => ({ id: c.id, name: c.name })),
    }),
  );

  return {
    meeting,
    actionItems: (actionItems ?? []) as MeetingActionItem[],
    targets,
  };
}
