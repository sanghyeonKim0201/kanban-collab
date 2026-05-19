"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, LogOut, Mic, Settings } from "lucide-react";
import { createClient } from "@/shared/api/supabase/client";
import { Button } from "@/shared/ui/button";
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

export function AppShell({
  user,
  children,
}: {
  user: UserProfile;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <nav className="flex items-center gap-1">
          <Link
            href="/workspaces"
            className="mr-4 flex items-center gap-2 font-semibold"
          >
            <LayoutGrid className="h-5 w-5" /> Kanban Collab
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/meetings">
              <Mic className="h-4 w-4" /> 회의록
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4" /> 설정
            </Link>
          </Button>
        </nav>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar>
              {user.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback>
                {(user.display_name ?? user.email ?? "?")
                  .charAt(0)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {user.display_name ?? user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="h-4 w-4" /> 로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
