import type { PrBadgeState } from "../model/transition";

const STYLES: Record<PrBadgeState, { label: string; cls: string }> = {
  open: { label: "PR 열림", cls: "bg-amber-500/15 text-amber-500" },
  merged: { label: "PR 머지", cls: "bg-violet-500/15 text-violet-400" },
  closed: { label: "PR 닫힘", cls: "bg-muted text-muted-foreground" },
};

export function PrStatusBadge({ state }: { state: PrBadgeState | null }) {
  if (!state) return null;
  const s = STYLES[state];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}
