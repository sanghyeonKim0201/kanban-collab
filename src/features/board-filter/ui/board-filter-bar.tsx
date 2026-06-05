"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type { Priority, UserProfile } from "@/shared/types/database";
import {
  type DueFilter,
  type FilterCriteria,
  EMPTY_CRITERIA,
  isFilterActive,
} from "../model/filter";

const triggerClass = "w-auto min-w-[7.5rem]";

const priorityOptions: { value: Priority | "all"; label: string }[] = [
  { value: "all", label: "우선순위 전체" },
  { value: "high", label: "high" },
  { value: "medium", label: "medium" },
  { value: "low", label: "low" },
];

const dueOptions: { value: DueFilter; label: string }[] = [
  { value: "all", label: "마감일 전체" },
  { value: "overdue", label: "기한 초과" },
  { value: "today", label: "오늘" },
  { value: "week", label: "이번 주" },
  { value: "none", label: "마감일 없음" },
];

export function BoardFilterBar({
  criteria,
  onChange,
  assignees,
}: {
  criteria: FilterCriteria;
  onChange: (next: FilterCriteria) => void;
  assignees: UserProfile[];
}) {
  const active = isFilterActive(criteria);

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={criteria.searchText}
          onChange={(e) => onChange({ ...criteria, searchText: e.target.value })}
          placeholder="카드 검색"
          aria-label="카드 검색"
          className="h-9 w-44 pl-8"
        />
      </div>

      <Select
        value={criteria.priority}
        onValueChange={(v) =>
          onChange({ ...criteria, priority: v as Priority | "all" })
        }
      >
        <SelectTrigger aria-label="우선순위 필터" className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {priorityOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={criteria.assigneeId}
        onValueChange={(v) => onChange({ ...criteria, assigneeId: v })}
      >
        <SelectTrigger aria-label="담당자 필터" className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">담당자 전체</SelectItem>
          {assignees.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.display_name ?? a.email ?? a.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={criteria.due}
        onValueChange={(v) => onChange({ ...criteria, due: v as DueFilter })}
      >
        <SelectTrigger aria-label="마감일 필터" className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {dueOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active && (
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_CRITERIA })}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> 초기화
        </button>
      )}
    </div>
  );
}
