import Link from "next/link";
import { notFound } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import {
  getWorkspace,
  listBoards,
  listMembers,
} from "@/entities/workspace/api/queries";
import { CreateBoardDialog } from "@/features/board-create/ui/create-board-dialog";
import { Card, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusPill } from "@/shared/ui/status-pill";
import { EmptyState } from "@/shared/ui/empty-state";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";

export const dynamic = "force-dynamic";

export default async function WorkspaceHome({
  params,
}: {
  params: { id: string };
}) {
  const ws = await getWorkspace(params.id);
  if (!ws) notFound();

  const [boards, members] = await Promise.all([
    listBoards(params.id),
    listMembers(params.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-foreground">{ws.name}</h1>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">보드</h2>
          <CreateBoardDialog workspaceId={params.id} />
        </div>
        {boards.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid />}
            title="보드가 없습니다"
            description="새 보드를 만들면 To Do · In Progress · Done 컬럼이 자동 생성됩니다."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {boards.map((b) => (
              <Link key={b.id} href={`/board/${b.id}`}>
                <Card className="transition-all hover:-translate-y-px hover:border-border-strong">
                  <CardHeader className="flex-row items-center gap-2 space-y-0">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-2 text-muted-foreground">
                      <LayoutGrid className="h-4 w-4" />
                    </span>
                    <CardTitle className="text-[15px]">{b.name}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">
          멤버 ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.user.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {(m.user.display_name ?? m.user.email ?? "?")
                    .charAt(0)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-[13px] text-foreground">
                {m.user.display_name ?? m.user.email}
              </span>
              <StatusPill tone="neutral">{m.role}</StatusPill>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
