import { listAllMyBoards } from "@/entities/board/api/queries";
import { getCurrentUser } from "@/entities/user/api/current-user";
import { RepoForm } from "@/features/github-link-card/ui/repo-form";
import { CopyWebhookUrl } from "@/features/github-link-card/ui/copy-webhook-url";
import { publicEnv } from "@/shared/config/env";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [boards, user] = await Promise.all([
    listAllMyBoards(),
    getCurrentUser(),
  ]);
  const webhookUrl = `${publicEnv().NEXT_PUBLIC_SITE_URL}/api/webhooks/github`;

  return (
    <div className="w-full max-w-3xl space-y-8 px-8 py-8">
      <section>
        <h1 className="mb-1 text-xl font-semibold text-foreground">설정</h1>
        <p className="text-sm text-muted-foreground">
          {user?.display_name ?? user?.email}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>GitHub 연동</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            보드별 저장소를{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-foreground">
              owner/repo
            </code>{" "}
            형식으로 연결하세요. GitHub 저장소 Webhook 에 아래 URL 을 등록하고{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-foreground">
              Content type: application/json
            </code>
            , 시크릿은{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-foreground">
              GITHUB_WEBHOOK_SECRET
            </code>{" "}
            과 동일하게 설정합니다.
          </p>
          <CopyWebhookUrl url={webhookUrl} />
          <div className="space-y-2 border-t border-border pt-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
