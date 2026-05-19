import { notFound } from "next/navigation";
import { getBoardWithColumnsAndCards } from "@/entities/board/api/queries";
import { BoardView } from "@/widgets/board-view/ui/board-view";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
}: {
  params: { boardId: string };
}) {
  const board = await getBoardWithColumnsAndCards(params.boardId);
  if (!board) notFound();

  return <BoardView initial={board} />;
}
