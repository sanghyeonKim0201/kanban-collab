"use client";
import Link from "next/link";
import { StatusPill } from "@/shared/ui/status-pill";
import type { ColumnWithCards } from "@/shared/types/database";

const priorityTone = { low: "neutral", medium: "warning", high: "danger" } as const;

export function BoardListView({
  columns,
  boardId,
}: {
  columns: ColumnWithCards[];
  boardId: string;
}) {
  const rows = columns.flatMap((c) =>
    c.cards.map((card) => ({ card, columnName: c.name })),
  );
  return (
    <table className="w-full text-[13px]">
      <thead className="border-b border-border text-left text-xs text-muted-foreground">
        <tr>
          <th className="px-4 py-2 font-medium">제목</th>
          <th className="px-4 py-2 font-medium">상태</th>
          <th className="px-4 py-2 font-medium">우선순위</th>
          <th className="px-4 py-2 font-medium">담당자</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={4}
              className="px-4 py-8 text-center text-muted-foreground"
            >
              조건에 맞는 카드가 없습니다.
            </td>
          </tr>
        )}
        {rows.map(({ card, columnName }) => (
          <tr key={card.id} className="border-b border-border/60 hover:bg-surface-2">
            <td className="px-4 py-2">
              <Link
                href={`/board/${boardId}/card/${card.id}`}
                className="hover:text-primary"
              >
                {card.title}
              </Link>
            </td>
            <td className="px-4 py-2">
              <StatusPill>{columnName}</StatusPill>
            </td>
            <td className="px-4 py-2">
              <StatusPill tone={priorityTone[card.priority]}>
                {card.priority}
              </StatusPill>
            </td>
            <td className="px-4 py-2 text-muted-foreground">
              {card.assignees.map((a) => a.display_name ?? a.email).join(", ") || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
