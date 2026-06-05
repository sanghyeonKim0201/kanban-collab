"use client";

import * as React from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

/** value 로 들어온 Date|string|null 을 Date|undefined 로 정규화. */
function toDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export interface DatePickerProps {
  value: Date | string | null | undefined;
  onChange: (value: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 표시 포맷(date-fns). 기본 yyyy-MM-dd. */
  displayFormat?: string;
  className?: string;
  "aria-label"?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "날짜 선택",
  disabled = false,
  displayFormat = "yyyy-MM-dd",
  className,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = toDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[13px] transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            "disabled:cursor-not-allowed disabled:opacity-50 hover:border-border-strong",
            selected ? "text-foreground" : "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">
            {selected ? format(selected, displayFormat, { locale: ko }) : placeholder}
          </span>
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="마감일 지우기"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(date ?? null);
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
