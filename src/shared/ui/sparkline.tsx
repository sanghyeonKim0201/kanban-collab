import { buildSparkline } from "@/shared/lib/sparkline-path";
import { cn } from "@/shared/lib/cn";

export function Sparkline({
  data,
  width = 120,
  height = 32,
  className,
  variant = "area",
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  variant?: "area" | "line";
}) {
  const { line, area } = buildSparkline(data, width, height);
  return (
    <svg width={width} height={height} className={cn("overflow-visible", className)}>
      {variant === "area" && area && (
        <path d={area} fill="hsl(var(--primary) / 0.15)" stroke="none" />
      )}
      {line && (
        <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
