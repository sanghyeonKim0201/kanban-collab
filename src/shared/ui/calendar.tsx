"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { ko } from "date-fns/locale";
import { cn } from "@/shared/lib/cn";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * react-day-picker 10 기반 shadcn 스타일 캘린더. 다크 토큰만 사용.
 * 한국어 로케일 기본 적용.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      locale={ko}
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        months: cn(defaults.months, "relative flex flex-col gap-4"),
        month: cn(defaults.month, "flex flex-col gap-3"),
        month_caption: cn(
          defaults.month_caption,
          "flex h-8 items-center justify-center px-8 text-sm font-medium text-foreground",
        ),
        caption_label: cn(defaults.caption_label, "text-sm font-medium"),
        nav: cn(defaults.nav, "absolute inset-x-0 top-0 flex items-center justify-between"),
        button_previous: cn(
          defaults.button_previous,
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40",
        ),
        button_next: cn(
          defaults.button_next,
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40",
        ),
        month_grid: cn(defaults.month_grid, "w-full border-collapse"),
        weekdays: cn(defaults.weekdays, "flex"),
        weekday: cn(
          defaults.weekday,
          "w-9 text-[0.7rem] font-normal text-muted-foreground",
        ),
        week: cn(defaults.week, "mt-1 flex w-full"),
        day: cn(
          defaults.day,
          "relative h-9 w-9 p-0 text-center text-sm",
        ),
        day_button: cn(
          defaults.day_button,
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-normal text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 aria-selected:opacity-100",
        ),
        selected: cn(
          defaults.selected,
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        ),
        today: cn(
          defaults.today,
          "[&>button]:border [&>button]:border-border-strong",
        ),
        outside: cn(defaults.outside, "[&>button]:text-muted-foreground/50"),
        disabled: cn(defaults.disabled, "[&>button]:opacity-40"),
        hidden: cn(defaults.hidden, "invisible"),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...rest }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("h-4 w-4", chevronClassName)} {...rest} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
