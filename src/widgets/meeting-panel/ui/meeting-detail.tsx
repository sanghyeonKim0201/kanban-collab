"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionItems } from "@/features/meeting-to-cards/ui/action-items";
import type { MeetingDetail } from "@/entities/meeting/api/queries";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";

export function MeetingDetailPanel({ detail }: { detail: MeetingDetail }) {
  const router = useRouter();
  const { meeting, actionItems, targets } = detail;
  const [pending, start] = useTransition();

  function call(path: string, label: string) {
    start(async () => {
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ meetingId: meeting.id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `${label} 실패`);
        toast.success(`${label} 완료`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `${label} 실패`);
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{meeting.title}</h1>
        <Badge variant={meeting.status === "done" ? "default" : "secondary"}>
          {meeting.status}
        </Badge>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending || !meeting.audio_url}
          onClick={() => call("/api/meetings/transcribe", "STT 변환")}
        >
          STT 변환
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || !meeting.transcript}
          onClick={() => call("/api/meetings/extract-tasks", "작업 추출")}
        >
          요약 · 작업 추출
        </Button>
      </div>

      {meeting.summary && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">요약</h2>
          <p className="rounded-md border bg-muted/40 p-3 text-sm">
            {meeting.summary}
          </p>
        </section>
      )}

      {meeting.transcript && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">전문</h2>
          <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border p-3 text-xs text-muted-foreground">
            {meeting.transcript}
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          작업 항목 ({actionItems.length})
        </h2>
        <ActionItems
          meetingId={meeting.id}
          items={actionItems}
          targets={targets}
        />
      </section>
    </div>
  );
}
