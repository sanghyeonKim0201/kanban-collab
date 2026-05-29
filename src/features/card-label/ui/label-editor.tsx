"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  attachLabel,
  createLabel,
  detachLabel,
} from "@/entities/label/api/actions";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type { Label } from "@/shared/types/database";

const DEFAULT_COLOR = "#22c55e";
const PRESET_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#ef4444",
  "#f59e0b",
  "#a855f7",
  "#64748b",
];

export function LabelEditor({
  cardId,
  boardId,
  attached,
  boardLabels,
}: {
  cardId: string;
  boardId: string;
  attached: Label[];
  boardLabels: Label[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const attachedIds = new Set(attached.map((l) => l.id));

  function toggle(label: Label) {
    start(async () => {
      try {
        if (attachedIds.has(label.id)) {
          await detachLabel(cardId, label.id, boardId);
        } else {
          await attachLabel(cardId, label.id, boardId);
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "레이블 변경 실패");
      }
    });
  }

  function create() {
    const value = name.trim();
    if (!value) return;
    start(async () => {
      try {
        const label = await createLabel(boardId, value, color);
        await attachLabel(cardId, label.id, boardId);
        setName("");
        setColor(DEFAULT_COLOR);
        setCreating(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "레이블 생성 실패");
      }
    });
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">레이블</p>
      <div className="flex flex-wrap gap-1.5">
        {boardLabels.map((l) => {
          const active = attachedIds.has(l.id);
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => toggle(l)}
              disabled={pending}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition",
                active ? "text-white" : "opacity-60 hover:opacity-100",
              )}
              style={
                active
                  ? { backgroundColor: l.color }
                  : { border: `1px solid ${l.color}` }
              }
            >
              {!active && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: l.color }}
                />
              )}
              {l.name}
            </button>
          );
        })}
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> 레이블
          </button>
        )}
      </div>

      {creating && (
        <div className="mt-2 space-y-2 rounded-md border p-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="레이블 이름"
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") {
                setCreating(false);
                setName("");
              }
            }}
          />
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`색상 ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  "h-6 w-6 rounded-full transition",
                  color === c &&
                    "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={create} disabled={pending}>
              추가
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setName("");
              }}
            >
              취소
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
