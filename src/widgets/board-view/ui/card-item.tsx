"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import type { CardWithRelations } from "@/shared/types/database";

const priorityStyles = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
} as const;

/** 카드 본문(표시 전용). 보드 카드와 드래그 오버레이가 공유한다. */
function CardBody({ card }: { card: CardWithRelations }) {
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-medium leading-snug">{card.title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          className={cn(
            "border-transparent text-[10px] capitalize",
            priorityStyles[card.priority],
          )}
        >
          {card.priority}
        </Badge>
        {card.due_date && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
            <CalendarClock className="h-3 w-3" />
            {card.due_date.slice(5, 10).replace("-", "/")}
          </span>
        )}
        {card.ai_category && (
          <Badge variant="secondary" className="text-[10px]">
            AI: {card.ai_category}
          </Badge>
        )}
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
    </div>
  );
}

export function CardItem({
  card,
  boardId,
}: {
  card: CardWithRelations;
  boardId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card", card } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group touch-none rounded-lg border bg-card p-3 shadow-sm transition-all",
        "cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        // 드래그 중 원본은 자리 표시용으로 흐리게(오버레이가 커서를 따라감)
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
    >
      <Link
        href={`/board/${boardId}/card/${card.id}`}
        className="block"
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
      >
        <CardBody card={card} />
      </Link>
    </div>
  );
}

/** DragOverlay 전용 — 커서를 따라다니는 카드 미리보기(sortable 아님). */
export function CardOverlay({ card }: { card: CardWithRelations }) {
  return (
    <div className="rotate-2 rounded-lg border bg-card p-3 shadow-xl ring-2 ring-primary cursor-grabbing">
      <CardBody card={card} />
    </div>
  );
}
