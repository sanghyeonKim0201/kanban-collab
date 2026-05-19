import Link from "next/link";
import { listMyWorkspaces } from "@/entities/workspace/api/queries";
import { CreateWorkspaceDialog } from "@/features/workspace-create/ui/create-workspace-dialog";
import { Card, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const workspaces = await listMyWorkspaces();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">워크스페이스</h1>
        <CreateWorkspaceDialog />
      </div>

      {workspaces.length === 0 ? (
        <p className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          아직 워크스페이스가 없습니다. 새로 만들어 보세요.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {workspaces.map((ws) => (
            <Link key={ws.id} href={`/workspaces/${ws.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>{ws.name}</CardTitle>
                  <Badge variant="secondary">{ws.role}</Badge>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
