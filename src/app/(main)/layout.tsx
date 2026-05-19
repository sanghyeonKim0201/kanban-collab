import { redirect } from "next/navigation";
import { getCurrentUser } from "@/entities/user/api/current-user";
import { AppShell } from "@/widgets/app-shell/ui/app-shell";
import { isSupabaseConfigured } from "@/shared/config/env";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">환경변수 설정 필요</h1>
          <p className="text-sm text-muted-foreground">
            <code>.env.local</code> 에 Supabase URL/Anon Key 를 설정한 뒤
            마이그레이션을 적용하세요. 자세한 절차는 README 를 참고하세요.
          </p>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <AppShell user={user}>{children}</AppShell>;
}
