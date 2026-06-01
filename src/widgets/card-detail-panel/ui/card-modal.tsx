"use client";

import { useRouter } from "next/navigation";
import {
  SlideOver,
  SlideOverContent,
  SlideOverTitle,
} from "@/shared/ui/slide-over";
import type { CardDetail } from "@/entities/card/api/detail";
import { CardDetailPanel } from "./card-detail";

/** 명세 7.2-3: 카드 클릭 → 우측 슬라이드 패널 → 닫으면 보드 복귀 */
export function CardModal({ detail }: { detail: CardDetail }) {
  const router = useRouter();
  return (
    <SlideOver open onOpenChange={(o) => !o && router.back()}>
      <SlideOverContent>
        <SlideOverTitle className="sr-only">카드 상세</SlideOverTitle>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <CardDetailPanel detail={detail} />
        </div>
      </SlideOverContent>
    </SlideOver>
  );
}
