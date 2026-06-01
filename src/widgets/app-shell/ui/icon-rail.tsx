"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Mic,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
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

const STORAGE_KEY = "sidebar-expanded";

export function IconRail({ user }: { user: UserProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const name = user.display_name ?? user.email ?? "?";

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-background py-3 transition-[width] duration-200",
        expanded ? "w-56 px-3" : "w-14 items-center px-0",
      )}
    >
      <Link
        href="/workspaces"
        className={cn(
          "mb-2 flex h-9 items-center gap-2 rounded-lg",
          expanded ? "px-2" : "w-9 justify-center",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <LayoutGrid className="h-5 w-5" />
        </span>
        {expanded && (
          <span className="truncate text-[13px] font-semibold text-foreground">
            Kanban Collab
          </span>
        )}
      </Link>

      <nav className="flex flex-col gap-1">
        {nav.map((n) => {
          const active = pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              title={expanded ? undefined : n.label}
              className={cn(
                "relative flex h-9 items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
                expanded ? "gap-3 px-2" : "w-9 justify-center",
                active &&
                  "bg-surface-2 text-foreground before:absolute before:h-5 before:w-0.5 before:rounded-full before:bg-primary" +
                    (expanded ? " before:-left-1" : " before:-left-3"),
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {expanded && <span className="truncate text-[13px]">{n.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn("mt-auto flex flex-col gap-1", expanded || "items-center")}>
        <button
          type="button"
          onClick={toggle}
          title={expanded ? "사이드바 접기" : "사이드바 펼치기"}
          aria-label={expanded ? "사이드바 접기" : "사이드바 펼치기"}
          aria-expanded={expanded}
          className={cn(
            "flex h-9 items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
            expanded ? "gap-3 px-2" : "w-9 justify-center",
          )}
        >
          {expanded ? (
            <PanelLeftClose className="h-[18px] w-[18px] shrink-0" />
          ) : (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" />
          )}
          {expanded && <span className="truncate text-[13px]">접기</span>}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-9 items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              expanded ? "gap-3 px-2" : "w-9 justify-center",
            )}
          >
            <Avatar className="h-7 w-7 shrink-0">
              {user.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback className="text-xs">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {expanded && (
              <span className="truncate text-[13px] text-foreground">{name}</span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end">
            <DropdownMenuLabel>{name}</DropdownMenuLabel>
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
