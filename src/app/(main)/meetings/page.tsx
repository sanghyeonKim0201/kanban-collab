import Link from "next/link";
import { Mic } from "lucide-react";
import { listMeetings } from "@/entities/meeting/api/queries";
import { listMyWorkspaces } from "@/entities/workspace/api/queries";
import { UploadForm } from "@/features/meeting-record/ui/upload-form";
import { Card, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusPill } from "@/shared/ui/status-pill";
import { EmptyState } from "@/shared/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const [meetings, workspaces] = await Promise.all([
    listMeetings(),
    listMyWorkspaces(),
  ]);

  return (
    <div className="w-full px-8 py-8">
      <h1 className="mb-6 text-xl font-semibold text-foreground">회의록</h1>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* 좌: 업로드 폼 (고정 폭) */}
        <div className="w-full shrink-0 lg:w-80">
          {workspaces.length > 0 ? (
            <UploadForm
              workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              먼저 워크스페이스를 만드세요.
            </p>
          )}
        </div>

        {/* 우: 회의 목록 */}
        <section className="min-w-0 flex-1 space-y-2">
          <h2 className="px-1 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
            업로드된 회의 ({meetings.length})
          </h2>
          {meetings.length === 0 ? (
            <EmptyState
              icon={<Mic />}
              title="업로드된 회의록이 없습니다"
              description="음성 파일 또는 텍스트를 업로드해 회의록을 만드세요."
            />
          ) : (
            meetings.map((m) => (
              <Link key={m.id} href={`/meetings/${m.id}`}>
                <Card className="transition-colors hover:bg-surface-2">
                  <CardHeader className="flex-row items-center justify-between space-y-0 px-4 py-3">
                    <CardTitle className="text-[14px]">{m.title}</CardTitle>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString("ko-KR")}
                      </span>
                      <StatusPill
                        tone={m.status === "done" ? "success" : "warning"}
                      >
                        {m.status === "done" ? "완료" : "대기 중"}
                      </StatusPill>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
