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
import { Badge } from "@/shared/ui/badge";
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
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-bold">{ws.name}</h1>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">보드</h2>
          <CreateBoardDialog workspaceId={params.id} />
        </div>
        {boards.length === 0 ? (
          <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            보드가 없습니다. 새 보드를 만들면 To Do · In Progress · Done 컬럼이
            자동 생성됩니다.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {boards.map((b) => (
              <Link key={b.id} href={`/board/${b.id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader className="flex-row items-center gap-2 space-y-0">
                    <LayoutGrid className="h-4 w-4" />
                    <CardTitle className="text-base">{b.name}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">멤버 ({members.length})</h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.user.id}
              className="flex items-center gap-3 rounded-md border p-2"
            >
              <Avatar>
                <AvatarFallback>
                  {(m.user.display_name ?? m.user.email ?? "?")
                    .charAt(0)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm">
                {m.user.display_name ?? m.user.email}
              </span>
              <Badge variant="secondary">{m.role}</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
