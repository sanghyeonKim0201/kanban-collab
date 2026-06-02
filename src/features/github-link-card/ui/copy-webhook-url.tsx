"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export function CopyWebhookUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 접근 실패 시 무시 (사용자가 수동 선택 가능)
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs text-muted-foreground">
        {url}
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label="Webhook URL 복사"
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium transition-colors",
          copied
            ? "border-success/40 bg-success/15 text-success"
            : "bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        )}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" /> 복사됨
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> 복사
          </>
        )}
      </button>
    </div>
  );
}
