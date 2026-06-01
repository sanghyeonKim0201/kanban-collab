"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionItems } from "@/features/meeting-to-cards/ui/action-items";
import type { MeetingDetail } from "@/entities/meeting/api/queries";
import { Button } from "@/shared/ui/button";
import { StatusPill } from "@/shared/ui/status-pill";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";

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
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{meeting.title}</h1>
        <StatusPill tone={meeting.status === "done" ? "success" : "warning"}>
          {meeting.status === "done" ? "완료" : "대기 중"}
        </StatusPill>
      </div>

      {/* 액션 버튼 */}
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
          size="sm"
          disabled={pending || !meeting.transcript}
          onClick={() => call("/api/meetings/extract-tasks", "작업 추출")}
        >
          요약 · 작업 추출
        </Button>
      </div>

      {/* 요약 */}
      {meeting.summary && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            요약
          </h2>
          <p className="rounded-lg border border-border bg-surface-2 p-4 text-sm text-foreground">
            {meeting.summary}
          </p>
        </section>
      )}

      {/* 탭: 트랜스크립트 / 추출된 작업 */}
      <Tabs defaultValue="transcript">
        <TabsList>
          <TabsTrigger value="transcript">트랜스크립트</TabsTrigger>
          <TabsTrigger value="actions">
            추출된 작업 ({actionItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transcript" className="pt-4">
          {meeting.transcript ? (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-surface-2 p-4">
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                {meeting.transcript}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              트랜스크립트가 없습니다. STT 변환을 먼저 실행하세요.
            </p>
          )}
        </TabsContent>

        <TabsContent value="actions" className="pt-4">
          <ActionItems
            meetingId={meeting.id}
            items={actionItems}
            targets={targets}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
