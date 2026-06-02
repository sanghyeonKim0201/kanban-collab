import { notFound } from "next/navigation";
import { getBoardWithColumnsAndCards } from "@/entities/board/api/queries";
import { getCurrentUser } from "@/entities/user/api/current-user";
import { getMyBoardRole } from "@/entities/board/api/role";
import { BoardView } from "@/widgets/board-view/ui/board-view";
import { CollaborationLayer } from "@/processes/realtime-collaboration/ui/collaboration-layer";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
}: {
  params: { boardId: string };
}) {
  const [board, user, role] = await Promise.all([
    getBoardWithColumnsAndCards(params.boardId),
    getCurrentUser(),
    getMyBoardRole(params.boardId),
  ]);
  if (!board) notFound();

  const canEdit = role === "owner" || role === "admin";

  return (
    <>
      <BoardView initial={board} canEdit={canEdit} />
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
