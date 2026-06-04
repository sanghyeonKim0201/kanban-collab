"use client";
import { LayoutGrid, List } from "lucide-react";
import { SegmentedControl } from "@/shared/ui/segmented-control";

export type BoardViewMode = "board" | "list";

export function BoardToolbar({
  name,
  mode,
  onMode,
  right,
  menu,
}: {
  name: string;
  mode: BoardViewMode;
  onMode: (m: BoardViewMode) => void;
  right?: React.ReactNode;
  menu?: React.ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-3">
      {/* menu(canEdit) 가 있으면 이름 렌더·편집을 menu 가 책임진다. */}
      {menu ?? (
        <h1 className="text-[15px] font-semibold text-foreground">{name}</h1>
      )}
      <SegmentedControl
        value={mode}
        onChange={onMode}
        options={[
          {
            value: "board" as BoardViewMode,
            label: (
              <>
                <LayoutGrid className="h-3.5 w-3.5" /> 보드
              </>
            ),
          },
          {
            value: "list" as BoardViewMode,
            label: (
              <>
                <List className="h-3.5 w-3.5" /> 리스트
              </>
            ),
          },
        ]}
      />
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </div>
  );
}
