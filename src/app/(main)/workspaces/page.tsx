import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { listMyWorkspaces } from "@/entities/workspace/api/queries";
import { CreateWorkspaceDialog } from "@/features/workspace-create/ui/create-workspace-dialog";
import { Card, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusPill } from "@/shared/ui/status-pill";
import { EmptyState } from "@/shared/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const workspaces = await listMyWorkspaces();

  return (
    <div className="mx-auto max-w-4xl p-8">
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
        <div className="grid gap-3 sm:grid-cols-2">
          {workspaces.map((ws) => (
            <Link key={ws.id} href={`/workspaces/${ws.id}`}>
              <Card className="transition-all hover:-translate-y-px hover:border-border-strong">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-[15px]">{ws.name}</CardTitle>
                  <StatusPill tone="primary">{ws.role}</StatusPill>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
