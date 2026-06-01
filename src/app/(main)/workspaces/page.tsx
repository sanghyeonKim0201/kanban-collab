import Link from "next/link";
import { LayoutGrid, Users } from "lucide-react";
import { listMyWorkspacesWithCounts } from "@/entities/workspace/api/queries";
import { CreateWorkspaceDialog } from "@/features/workspace-create/ui/create-workspace-dialog";
import { Card } from "@/shared/ui/card";
import { StatusPill } from "@/shared/ui/status-pill";
import { EmptyState } from "@/shared/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const workspaces = await listMyWorkspacesWithCounts();

  return (
    <div className="w-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">워크스페이스</h1>
        <CreateWorkspaceDialog />
      </div>

      {workspaces.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid />}
          title="아직 워크스페이스가 없습니다"
          description="새 워크스페이스를 만들어 보드와 팀을 모아보세요."
          action={<CreateWorkspaceDialog />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workspaces.map((ws) => (
            <Link key={ws.id} href={`/workspaces/${ws.id}`}>
              <Card className="h-full p-4 transition-all hover:-translate-y-px hover:border-border-strong">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
                    <LayoutGrid className="h-4 w-4" />
                  </span>
                  <StatusPill tone="primary">{ws.role}</StatusPill>
                </div>
                <h2 className="mt-3 truncate text-[15px] font-semibold text-foreground">
                  {ws.name}
                </h2>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    보드 {ws.boardCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    멤버 {ws.memberCount}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
