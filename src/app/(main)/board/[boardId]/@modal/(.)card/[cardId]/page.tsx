import { notFound } from "next/navigation";
import { getCardDetail } from "@/entities/card/api/detail";
import { CardModal } from "@/widgets/card-detail-panel/ui/card-modal";

export const dynamic = "force-dynamic";

export default async function InterceptedCardModal({
  params,
}: {
  params: { cardId: string };
}) {
  const detail = await getCardDetail(params.cardId);
  if (!detail) notFound();
  return <CardModal detail={detail} />;
}
