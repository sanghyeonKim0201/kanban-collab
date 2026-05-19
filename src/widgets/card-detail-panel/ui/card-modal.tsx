"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import type { CardDetail } from "@/entities/card/api/detail";
import { CardDetailPanel } from "./card-detail";

/** 명세 7.2-3: 카드 클릭 → 상세 패널 열림 → 닫으면 보드 복귀 */
export function CardModal({ detail }: { detail: CardDetail }) {
  const router = useRouter();
  return (
    <Dialog open onOpenChange={(o) => !o && router.back()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="sr-only">카드 상세</DialogTitle>
        </DialogHeader>
        <CardDetailPanel detail={detail} />
      </DialogContent>
    </Dialog>
  );
}
