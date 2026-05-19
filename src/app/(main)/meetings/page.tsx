import Link from "next/link";
import { listMeetings } from "@/entities/meeting/api/queries";
import { listMyWorkspaces } from "@/entities/workspace/api/queries";
import { UploadForm } from "@/features/meeting-record/ui/upload-form";
import { Card, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const [meetings, workspaces] = await Promise.all([
    listMeetings(),
    listMyWorkspaces(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="mb-4 text-2xl font-bold">회의록</h1>
        {workspaces.length > 0 ? (
          <UploadForm
            workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            먼저 워크스페이스를 만드세요.
          </p>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">목록</h2>
        {meetings.length === 0 ? (
          <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            업로드된 회의록이 없습니다.
          </p>
        ) : (
          meetings.map((m) => (
            <Link key={m.id} href={`/meetings/${m.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <Badge
                    variant={m.status === "done" ? "default" : "secondary"}
                  >
                    {m.status}
                  </Badge>
                </CardHeader>
              </Card>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
