import { listAllMyBoards } from "@/entities/board/api/queries";
import { getCurrentUser } from "@/entities/user/api/current-user";
import { RepoForm } from "@/features/github-link-card/ui/repo-form";
import { publicEnv } from "@/shared/config/env";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [boards, user] = await Promise.all([
    listAllMyBoards(),
    getCurrentUser(),
  ]);
  const webhookUrl = `${publicEnv().NEXT_PUBLIC_SITE_URL}/api/webhooks/github`;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <section>
        <h1 className="mb-1 text-2xl font-bold">설정</h1>
        <p className="text-sm text-muted-foreground">
          {user?.display_name ?? user?.email}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">GitHub 연동</h2>
        <p className="text-sm text-muted-foreground">
          보드별 저장소를 <code>owner/repo</code> 형식으로 연결하세요. GitHub
          저장소 Webhook 에 아래 URL 을 등록하고{" "}
          <code>Content type: application/json</code>, 시크릿은{" "}
          <code>GITHUB_WEBHOOK_SECRET</code> 과 동일하게 설정합니다.
        </p>
        <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">
          {webhookUrl}
        </pre>
        <div className="space-y-2">
          {boards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              연결할 보드가 없습니다.
            </p>
          ) : (
            boards.map((b) => (
              <RepoForm
                key={b.id}
                boardId={b.id}
                boardName={b.name}
                current={b.github_repo}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
