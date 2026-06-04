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

/** 명세 8.3-4: action item → 카드 생성 후 card_id 연결 */
export async function createCardFromActionItem(input: {
  actionItemId: string;
  columnId: string;
  title: string;
  meetingId: string;
}) {
  const { supabase, user } = await requireUser();

  // createCard 와 동일한 동시 생성 충돌(같은 컬럼 끝 동시 append → 23505) 견고화.
  const { value: cardId } = await appendWithRetryReturning<string>(
    async () => {
      const { data: lastCard } = await supabase
        .from("cards")
        .select("position")
        .eq("column_id", input.columnId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      return lastCard?.position ?? null;
    },
    async (position) => {
      const { data: card, error } = await supabase
        .from("cards")
        .insert({
          column_id: input.columnId,
          title: input.title,
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

  const { error: linkErr } = await supabase
    .from("meeting_action_items")
    .update({ card_id: cardId })
    .eq("id", input.actionItemId);
  if (linkErr) throw new Error(linkErr.message);

  revalidatePath(`/meetings/${input.meetingId}`);
  return cardId;
}
