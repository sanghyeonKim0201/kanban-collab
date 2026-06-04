"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { assignCard, updateCard } from "@/entities/card/api/actions";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { StatusPill } from "@/shared/ui/status-pill";

const AUTO_KEY = "ai-classify-auto-apply";

/** /api/ai/classify 응답 (route 의 ClassifyResponse 와 일치). */
interface ClassifyResult {
  category: string;
  priority: "low" | "medium" | "high";
  confidence: number;
  suggestedAssignee: { id: string; name: string | null } | null;
}

export function ClassifyPanel({
  cardId,
  boardId,
  currentCategory,
  assignedIds = [],
}: {
  cardId: string;
  boardId: string;
  currentCategory: string | null;
  /** 이미 카드에 지정된 담당자 id 목록(중복 지정 방지·표시용). */
  assignedIds?: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [autoApply, setAutoApply] = useState(false);

  useEffect(() => {
    setAutoApply(localStorage.getItem(AUTO_KEY) === "1");
  }, []);

  function toggleAuto() {
    const next = !autoApply;
    setAutoApply(next);
    localStorage.setItem(AUTO_KEY, next ? "1" : "0");
  }

  function classify() {
    start(async () => {
      try {
        const res = await fetch("/api/ai/classify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cardId }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "분류 실패");
        const data = (await res.json()) as ClassifyResult;
        setResult(data);
        if (autoApply) await apply(data);
        else router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "분류 실패");
      }
    });
  }

  async function apply(data: ClassifyResult) {
    await updateCard(
      cardId,
      { priority: data.priority, ai_category: data.category },
      boardId,
    );
    // FR-21: 추천 담당자가 있고 아직 지정되지 않았으면 함께 지정.
    if (data.suggestedAssignee && !assignedIds.includes(data.suggestedAssignee.id)) {
      await assignCard(cardId, data.suggestedAssignee.id, boardId);
    }
    toast.success("추천 적용됨");
    setResult(null);
    router.refresh();
  }

  return (
    <div className="rounded-md border border-dashed border-border p-3 text-xs text-foreground">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-medium">
          <Sparkles className="h-3.5 w-3.5" /> AI 분류
        </p>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <input
            type="checkbox"
            checked={autoApply}
            onChange={toggleAuto}
          />
          자동 적용 (기본 OFF)
        </label>
      </div>

      {currentCategory && !result && (
        <p className="mt-1 text-muted-foreground">
          현재 추천 카테고리: <StatusPill tone="primary">{currentCategory}</StatusPill>
        </p>
      )}

      {result ? (
        <div className="mt-2 space-y-2">
          <p>
            추천: <StatusPill tone="primary">{result.category}</StatusPill>{" "}
            <Badge variant="outline">{result.priority}</Badge>{" "}
            <span className="text-muted-foreground">
              confidence {Math.round(result.confidence * 100)}%
            </span>
          </p>
          {result.suggestedAssignee && (
            <p className="text-muted-foreground">
              추천 담당자:{" "}
              <StatusPill tone="primary">
                {result.suggestedAssignee.name ?? "이름 없음"}
              </StatusPill>
              {assignedIds.includes(result.suggestedAssignee.id) && (
                <span className="ml-1 text-[10px]">(이미 지정됨)</span>
              )}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => start(() => apply(result))}
            >
              적용
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setResult(null)}
            >
              거부
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          disabled={pending}
          onClick={classify}
        >
          {pending ? "분석 중…" : "AI 추천 받기"}
        </Button>
      )}
    </div>
  );
}
