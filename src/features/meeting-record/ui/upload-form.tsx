"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMeeting } from "@/entities/meeting/api/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

export function UploadForm({
  workspaces,
}: {
  workspaces: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"audio" | "text">("audio");

  function onSubmit(formData: FormData) {
    start(async () => {
      try {
        const id = await createMeeting(formData);
        toast.success("회의록 업로드됨");
        router.push(`/meetings/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "업로드 실패");
      }
    });
  }

  return (
    <form
      action={onSubmit}
      className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card"
    >
      <div className="space-y-1.5">
        <Label htmlFor="ws">워크스페이스</Label>
        <select
          id="ws"
          name="workspaceId"
          required
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "audio" ? "default" : "outline"}
          onClick={() => setMode("audio")}
        >
          음성 파일
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "text" ? "default" : "outline"}
          onClick={() => setMode("text")}
        >
          텍스트
        </Button>
      </div>

      {mode === "audio" ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-6 text-center">
          <p className="mb-3 text-xs text-muted-foreground">
            .mp3 · .m4a · .wav 파일을 선택하세요
          </p>
          <Input
            type="file"
            name="file"
            accept=".mp3,.m4a,.wav,audio/*"
            className="mx-auto max-w-xs"
          />
        </div>
      ) : (
        <Textarea
          name="transcript"
          rows={6}
          placeholder="회의 내용을 붙여넣으세요"
          className="resize-none"
        />
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "업로드 중…" : "업로드"}
      </Button>
    </form>
  );
}
