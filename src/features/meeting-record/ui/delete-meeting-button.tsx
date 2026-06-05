"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteMeeting } from "@/entities/meeting/api/actions";
import { Button } from "@/shared/ui/button";

/** 회의록 삭제 버튼. redirectTo 가 있으면 삭제 후 이동(상세), 없으면 목록 새로고침. */
export function DeleteMeetingButton({
  meetingId,
  redirectTo,
  withLabel = false,
}: {
  meetingId: string;
  redirectTo?: string;
  withLabel?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onDelete() {
    if (!window.confirm("이 회의록을 삭제할까요? 되돌릴 수 없습니다.")) return;
    startTransition(async () => {
      try {
        await deleteMeeting(meetingId);
        toast.success("회의록을 삭제했습니다");
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다");
      }
    });
  }

  if (withLabel) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onDelete}
        disabled={pending}
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        {pending ? "삭제 중…" : "삭제"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onDelete}
      disabled={pending}
      aria-label="회의록 삭제"
      className="shrink-0 text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
