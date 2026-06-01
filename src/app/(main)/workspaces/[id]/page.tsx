import Link from "next/link";
import { notFound } from "next/navigation";
import { LayoutGrid, Layers } from "lucide-react";
import {
  getWorkspace,
  listBoardsWithCounts,
  listMembers,
} from "@/entities/workspace/api/queries";
import { CreateBoardDialog } from "@/features/board-create/ui/create-board-dialog";
import { Card } from "@/shared/ui/card";
import { StatusPill } from "@/shared/ui/status-pill";
import { EmptyState } from "@/shared/ui/empty-state";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";

export const dynamic = "force-dynamic";

const CARD_GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export default async function WorkspaceHome({
  params,
}: {
  params: { id: string };
}) {
  const ws = await getWorkspace(params.id);
  if (!ws) notFound();

  const [boards, members] = await Promise.all([
    listBoardsWithCounts(params.id),
    listMembers(params.id),
  ]);

  return (
    <div className="w-full px-8 py-8">
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
          <div className={CARD_GRID}>
            {boards.map((b) => (
              <Link key={b.id} href={`/board/${b.id}`}>
                <Card className="h-full p-4 transition-all hover:-translate-y-px hover:border-border-strong">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
                    <LayoutGrid className="h-4 w-4" />
                  </span>
                  <h3 className="mt-3 truncate text-[15px] font-semibold text-foreground">
                    {b.name}
                  </h3>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    카드 {b.cardCount}
                  </p>
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
        <div className={CARD_GRID}>
          {members.map((m) => {
            const label = m.user.display_name ?? m.user.email ?? "?";
            return (
              <div
                key={m.user.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs">
                    {label.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-[13px] text-foreground">
                  {label}
                </span>
                <StatusPill tone="neutral">{m.role}</StatusPill>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
