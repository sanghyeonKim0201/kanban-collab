import { notFound } from "next/navigation";
import { getBoardWithColumnsAndCards } from "@/entities/board/api/queries";
import { getCurrentUser } from "@/entities/user/api/current-user";
import { getMyBoardRole } from "@/entities/board/api/role";
import { listBoardActivity } from "@/entities/board/api/activity";
import { BoardView } from "@/widgets/board-view/ui/board-view";
import { CollaborationLayer } from "@/processes/realtime-collaboration/ui/collaboration-layer";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
}: {
  params: { boardId: string };
}) {
  const [board, user, role, activity] = await Promise.all([
    getBoardWithColumnsAndCards(params.boardId),
    getCurrentUser(),
    getMyBoardRole(params.boardId),
    listBoardActivity(params.boardId),
  ]);
  if (!board) notFound();

  const canEdit = role === "owner" || role === "admin";

  return (
    <>
      <BoardView initial={board} canEdit={canEdit} initialActivity={activity} />
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
