import { notFound } from "next/navigation";
import { getCardDetail } from "@/entities/card/api/detail";
import { CardDetailPanel } from "@/widgets/card-detail-panel/ui/card-detail";

export const dynamic = "force-dynamic";

/** 직접 진입/새로고침 시 전체 페이지 폴백 */
export default async function CardPage({
  params,
}: {
  params: { cardId: string };
}) {
  const detail = await getCardDetail(params.cardId);
  if (!detail) notFound();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <CardDetailPanel detail={detail} />
    </div>
  );
}
