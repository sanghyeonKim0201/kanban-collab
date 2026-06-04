"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/shared/lib/cn";
import { StatusPill } from "@/shared/ui/status-pill";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { PrStatusBadge } from "@/features/pr-automation/ui/pr-status-badge";
import type { CardWithRelations } from "@/shared/types/database";

const priorityTone = { low: "neutral", medium: "warning", high: "danger" } as const;
const priorityBar = {
  low: "bg-muted-foreground/40",
  medium: "bg-warning",
  high: "bg-destructive",
} as const;

export function CardItem({
  card,
  boardId,
  dragDisabled = false,
}: {
  card: CardWithRelations;
  boardId: string;
  dragDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card", card }, disabled: dragDisabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-surface-2 p-3 transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-card",
        isDragging && "opacity-50 shadow-elevated",
      )}
      {...attributes}
      {...listeners}
    >
      <span
        className={cn("absolute inset-y-0 left-0 w-0.5", priorityBar[card.priority])}
      />
      <Link
        href={`/board/${boardId}/card/${card.id}`}
        className="block space-y-2"
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
      >
        <p className="text-[13px] font-medium leading-snug text-foreground">
          {card.title}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill tone={priorityTone[card.priority]}>{card.priority}</StatusPill>
          {card.ai_category && (
            <StatusPill tone="primary">AI: {card.ai_category}</StatusPill>
          )}
          <PrStatusBadge state={card.github_pr_state} />
          {card.labels.map((l) => (
            <span
              key={l.id}
              className="h-2 w-2 rounded-full"
              style={{ background: l.color }}
              title={l.name}
            />
          ))}
          <div className="ml-auto flex -space-x-1.5">
            {card.assignees.map((a) => (
              <Avatar key={a.id} className="h-5 w-5 border border-background">
                <AvatarFallback className="text-[9px]">
                  {(a.display_name ?? a.email ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
      </Link>
    </div>
  );
}
