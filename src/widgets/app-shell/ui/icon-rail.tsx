"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Mic, Settings, LogOut } from "lucide-react";
import { createClient } from "@/shared/api/supabase/client";
import { cn } from "@/shared/lib/cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { UserProfile } from "@/shared/types/database";

const nav = [
  { href: "/workspaces", icon: LayoutGrid, label: "워크스페이스" },
  { href: "/meetings", icon: Mic, label: "회의록" },
  { href: "/settings", icon: Settings, label: "설정" },
];

export function IconRail({ user }: { user: UserProfile }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-background py-3">
      <Link
        href="/workspaces"
        className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
      >
        <LayoutGrid className="h-5 w-5" />
      </Link>
      {nav.map((n) => {
        const active = pathname.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            title={n.label}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
              active &&
                "bg-surface-2 text-foreground before:absolute before:-left-3 before:h-5 before:w-0.5 before:rounded-full before:bg-primary",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </Link>
        );
      })}
      <div className="mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="h-8 w-8">
              {user.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback className="text-xs">
                {(user.display_name ?? user.email ?? "?")
                  .charAt(0)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end">
            <DropdownMenuLabel>
              {user.display_name ?? user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="h-4 w-4" /> 로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
