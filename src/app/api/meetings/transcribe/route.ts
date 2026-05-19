import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/api/supabase/server";
import { transcribeAudio } from "@/shared/api/stt";

export const runtime = "nodejs";

const bodySchema = z.object({ meetingId: z.string().uuid() });

/** 명세 8.3-2: 음성 파일 → STT → meetings.transcript */
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
    .select("id, audio_url, transcript")
    .eq("id", parsed.data.meetingId)
    .maybeSingle();
  if (!meeting) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!meeting.audio_url) {
    return NextResponse.json({
      ok: true,
      skipped: "텍스트 회의록 — STT 불필요",
    });
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from("meetings")
    .download(meeting.audio_url);
  if (dlErr || !blob) {
    return NextResponse.json(
      { error: dlErr?.message ?? "다운로드 실패" },
      { status: 500 },
    );
  }

  let text: string;
  try {
    text = await transcribeAudio(blob, meeting.audio_url.split("/").pop()!);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "STT 실패" },
      { status: 502 },
    );
  }

  await supabase
    .from("meetings")
    .update({ transcript: text })
    .eq("id", meeting.id);

  return NextResponse.json({ ok: true, length: text.length });
}
