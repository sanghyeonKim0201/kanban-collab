import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/api/supabase/server";
import { summarizeMeeting } from "@/shared/api/llm";

export const runtime = "nodejs";

const bodySchema = z.object({ meetingId: z.string().uuid() });

/** 명세 8.3-3: transcript → 요약 + action items → meetings/meeting_action_items */
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

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, transcript")
    .eq("id", parsed.data.meetingId)
    .maybeSingle();
  if (!meeting) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!meeting.transcript) {
    return NextResponse.json(
      { error: "transcript 없음 — 먼저 STT 를 실행하세요" },
      { status: 400 },
    );
  }

  let extract;
  try {
    extract = await summarizeMeeting(meeting.transcript);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "추출 실패" },
      { status: 502 },
    );
  }

  await supabase
    .from("meetings")
    .update({ summary: extract.summary, status: "done" })
    .eq("id", meeting.id);

  if (extract.actionItems.length) {
    await supabase.from("meeting_action_items").insert(
      extract.actionItems.map((a) => ({
        meeting_id: meeting.id,
        title: a.title,
        suggested_assignee: a.suggestedAssignee ?? null,
      })),
    );
  }

  return NextResponse.json({
    ok: true,
    actionItems: extract.actionItems.length,
  });
}
