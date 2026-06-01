"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { updateCard } from "@/entities/card/api/actions";
import type { Classification } from "@/shared/lib/parse-llm-json";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { StatusPill } from "@/shared/ui/status-pill";

const AUTO_KEY = "ai-classify-auto-apply";

export function ClassifyPanel({
  cardId,
  boardId,
  currentCategory,
}: {
  cardId: string;
  boardId: string;
  currentCategory: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Classification | null>(null);
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
        const data = (await res.json()) as Classification;
        setResult(data);
        if (autoApply) await apply(data);
        else router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "분류 실패");
      }
    });
  }

  async function apply(data: Classification) {
    await updateCard(
      cardId,
      { priority: data.priority, ai_category: data.category },
      boardId,
    );
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
