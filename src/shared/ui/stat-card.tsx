import { cn } from "@/shared/lib/cn";
import { Sparkline } from "./sparkline";

export function StatCard({
  label,
  value,
  series,
  className,
}: {
  label: string;
  value: React.ReactNode;
  series?: number[];
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-3", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums text-foreground">{value}</span>
        {series && series.length > 1 && <Sparkline data={series} width={72} height={28} />}
      </div>
    </div>
  );
}
