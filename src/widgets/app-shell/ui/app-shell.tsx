import { IconRail } from "./icon-rail";
import type { UserProfile } from "@/shared/types/database";

export function AppShell({
  user,
  children,
}: {
  user: UserProfile;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <IconRail user={user} />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
