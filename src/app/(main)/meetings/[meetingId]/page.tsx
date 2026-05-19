import { notFound } from "next/navigation";
import { getMeetingDetail } from "@/entities/meeting/api/queries";
import { MeetingDetailPanel } from "@/widgets/meeting-panel/ui/meeting-detail";

export const dynamic = "force-dynamic";

export default async function MeetingPage({
  params,
}: {
  params: { meetingId: string };
}) {
  const detail = await getMeetingDetail(params.meetingId);
  if (!detail) notFound();
  return <MeetingDetailPanel detail={detail} />;
}
