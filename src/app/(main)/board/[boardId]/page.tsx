import { notFound } from "next/navigation";
import { getBoardWithColumnsAndCards } from "@/entities/board/api/queries";
import { listMembers } from "@/entities/workspace/api/queries";
import { getCurrentUser } from "@/entities/user/api/current-user";
import { BoardView } from "@/widgets/board-view/ui/board-view";
import { CollaborationLayer } from "@/processes/realtime-collaboration/ui/collaboration-layer";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
}: {
  params: { boardId: string };
}) {
  const [board, user] = await Promise.all([
    getBoardWithColumnsAndCards(params.boardId),
    getCurrentUser(),
  ]);
  if (!board) notFound();

  const members = await listMembers(board.workspace_id);

  return (
    <>
      <BoardView initial={board} members={members} />
      {user && (
        <CollaborationLayer
          boardId={board.id}
          userId={user.id}
          name={user.display_name ?? user.email ?? "익명"}
        />
      )}
    </>
  );
}
