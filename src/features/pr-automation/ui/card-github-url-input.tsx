"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateCard } from "@/entities/card/api/actions";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";

export function CardGithubUrlInput({
  cardId,
  boardId,
  initialUrl,
}: {
  cardId: string;
  boardId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = url.trim();
    setSaving(true);
    try {
      await updateCard(cardId, { github_url: value === "" ? null : value }, boardId);
      toast.success("PR 링크 저장됨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        value={url}
        placeholder="https://github.com/owner/repo/pull/42"
        onChange={(e) => setUrl(e.target.value)}
      />
      <Button size="sm" onClick={save} disabled={saving}>
        저장
      </Button>
    </div>
  );
}
