import { cn } from "@/shared/lib/cn";

export function WorkPane({
  secondary,
  toolbar,
  children,
  className,
}: {
  secondary?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex h-screen min-w-0 flex-1">
      {secondary && (
        <div className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface/40 md:flex">
          {secondary}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {toolbar && (
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            {toolbar}
          </div>
        )}
        <div className={cn("min-h-0 flex-1 overflow-auto", className)}>
          {children}
        </div>
      </div>
    </div>
  );
}
