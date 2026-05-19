"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import type { CardWithRelations } from "@/shared/types/database";

const priorityVariant = {
  low: "secondary",
  medium: "outline",
  high: "destructive",
} as const;

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
        "rounded-md border bg-card p-3 shadow-sm",
        isDragging && "opacity-50",
      )}
      {...attributes}
      {...listeners}
    >
      <Link
        href={`/board/${boardId}/card/${card.id}`}
        className="block space-y-2"
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
      >
        <p className="text-sm font-medium leading-snug">{card.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={priorityVariant[card.priority]} className="text-[10px]">
            {card.priority}
          </Badge>
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
      </Link>
    </div>
  );
}
