"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/shared/api/supabase/auth";
import {
  UNIQUE_VIOLATION,
  appendWithRetryReturning,
} from "@/shared/lib/append-position";

/** 명세 8.3-1: 음성/텍스트 업로드 → Storage + meetings(status=pending) */
export async function createMeeting(formData: FormData) {
  const workspaceId = z
    .string()
    .uuid()
    .parse(formData.get("workspaceId"));
  const title = z
    .string()
    .trim()
    .min(1)
    .max(160)
    .parse(formData.get("title"));
  const file = formData.get("file");
  const textTranscript = formData.get("transcript");

  const { supabase } = await requireUser();

  let audioUrl: string | null = null;
  let transcript: string | null = null;

  if (file instanceof File && file.size > 0) {
    const path = `${workspaceId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("meetings")
      .upload(path, file, { upsert: false });
    if (upErr) throw new Error(upErr.message);
    audioUrl = path;
  } else if (typeof textTranscript === "string" && textTranscript.trim()) {
    transcript = textTranscript.trim();
  } else {
    throw new Error("음성 파일 또는 텍스트를 입력하세요");
  }

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      workspace_id: workspaceId,
      title,
      audio_url: audioUrl,
      transcript,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/meetings");
  return data.id as string;
}

/**
 * 명세 8.3-4 / FR-25: action item → 카드 생성 후 card_id 연결.
 * 보드 추가 전 사용자가 수정한 title/assignee 를 반영한다.
 *  - title: 빈 문자열 불가(원본 fallback 은 UI 가 막지만 서버에서도 검증).
 *  - suggestedAssignee: 편집값을 action item 에 함께 저장(감사/표시용).
 */
const cardFromActionItemSchema = z.object({
  actionItemId: z.string().uuid(),
  columnId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  suggestedAssignee: z.string().trim().max(160).nullable().optional(),
  meetingId: z.string().uuid(),
});

export async function createCardFromActionItem(input: {
  actionItemId: string;
  columnId: string;
  title: string;
  suggestedAssignee?: string | null;
  meetingId: string;
}) {
  const parsed = cardFromActionItemSchema.parse(input);
  const { supabase, user } = await requireUser();

  const assignee =
    parsed.suggestedAssignee && parsed.suggestedAssignee !== ""
      ? parsed.suggestedAssignee
      : null;

  // createCard 와 동일한 동시 생성 충돌(같은 컬럼 끝 동시 append → 23505) 견고화.
  const { value: cardId } = await appendWithRetryReturning<string>(
    async () => {
      const { data: lastCard } = await supabase
        .from("cards")
        .select("position")
        .eq("column_id", parsed.columnId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      return lastCard?.position ?? null;
    },
    async (position) => {
      const { data: card, error } = await supabase
        .from("cards")
        .insert({
          column_id: parsed.columnId,
          title: parsed.title,
          position,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return { conflict: true };
        throw new Error(error.message);
      }
      return { conflict: false, value: card.id as string };
    },
  );

  // FR-25: 편집된 title/assignee 를 action item 에도 반영하고 card_id 연결.
  const { error: linkErr } = await supabase
    .from("meeting_action_items")
    .update({
      card_id: cardId,
      title: parsed.title,
      suggested_assignee: assignee,
    })
    .eq("id", parsed.actionItemId);
  if (linkErr) throw new Error(linkErr.message);

  revalidatePath(`/meetings/${parsed.meetingId}`);
  return cardId;
}
