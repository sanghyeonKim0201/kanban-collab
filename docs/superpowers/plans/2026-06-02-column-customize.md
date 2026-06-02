# 컬럼 커스터마이즈 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 칸반 보드 컬럼을 owner/admin이 인라인으로 추가·이름변경·삭제(카드 0개 시만)·드래그 재정렬할 수 있는 UI를 붙인다.

**Architecture:** 서버액션 4종(`createColumn`/`renameColumn`/`reorderColumn`/`deleteColumn`)은 이미 존재 — UI만 추가한다. 실시간 구독이 이미 `columns` 변경을 디바운스 resync 하므로 추가/이름변경/삭제는 "서버액션 → 자동 resync"로 단순하게, 재정렬만 드래그 피드백을 위해 낙관적 업데이트한다. 컬럼 정렬 드래그는 카드 dnd와 같은 DndContext에서 `data.type` 분기(`"column-sort"` vs `"card"`)로 충돌을 피한다. 편집 UI는 owner/admin에게만 노출(RLS가 최종 방어선).

**Tech Stack:** Next.js 14 App Router, React 18, zustand, @dnd-kit, Tailwind, Radix dropdown, vitest. LexoRank `between()`.

---

## 제약 (전 태스크 공통)

- **스키마/RLS 0 변경.** 서버액션 4종 시그니처 변경 금지(단, Task 6의 deleteColumn 카드-가드는 내부 로직 추가만).
- **카드 dnd 로직 보존** — `use-card-dnd`의 카드 이동 분기는 그대로, 컬럼 분기만 추가.
- **기존 35개 단위 테스트 green 유지.** 각 태스크 끝 `pnpm test`.
- **검증 루틴:** `pnpm typecheck && pnpm lint && pnpm test` → 비주얼은 dev 프리뷰. pnpm 사용.
- 경로 별칭 `@/` → `src/`. strict TS(`noUncheckedIndexedAccess`).

## File Structure

**신규**
- `src/entities/board/api/role.ts` — `getMyBoardRole(boardId)` 읽기 쿼리
- `src/features/column-edit/ui/column-header.tsx` — 인라인 이름편집 + ⋯ 메뉴 + 드래그 핸들
- `src/features/column-edit/ui/add-column.tsx` — `+ 컬럼 추가` 인라인
- `src/features/column-edit/model/use-column-actions.ts` — add/rename/delete 래퍼(토스트)
- `tests/unit/board-column-store.test.ts` — 스토어 컬럼 메서드 테스트

**수정**
- `src/entities/board/model/store.ts` — 컬럼 낙관적 메서드 추가
- `src/widgets/board-view/ui/board-column.tsx` — 헤더를 ColumnHeader로 교체, 컬럼 sortable 배선
- `src/widgets/board-view/ui/board-view.tsx` — 수평 SortableContext + onDragEnd 타입 분기 + canEdit 전달
- `src/features/card-drag/model/use-card-dnd.ts` — onDragEnd에 컬럼 재정렬 분기
- `src/app/(main)/board/[boardId]/page.tsx` — role 조회 후 BoardView에 canEditColumns 전달

---

## Task 1: 보드 role 읽기 쿼리

**Files:**
- Create: `src/entities/board/api/role.ts`

- [ ] **Step 1: 쿼리 작성**

기존 패턴(`entities/board/api/queries.ts`의 동기 `createClient()`)을 따른다. 보드 → 워크스페이스 → 멤버 role 조회.

```ts
import "server-only";
import { createClient } from "@/shared/api/supabase/server";
import type { Role } from "@/shared/types/database";

/** 현재 유저의 이 보드(워크스페이스) 역할. 멤버 아니면 null. */
export async function getMyBoardRole(boardId: string): Promise<Role | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: board } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .maybeSingle();
  if (!board) return null;

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", board.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  return (member?.role as Role | undefined) ?? null;
}
```

- [ ] **Step 2: 검증**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/entities/board/api/role.ts
git commit -m "feat(board): 현재 유저 보드 역할 조회 쿼리"
```

---

## Task 2: 보드 스토어 컬럼 메서드 (TDD)

**Files:**
- Modify: `src/entities/board/model/store.ts`
- Test: `tests/unit/board-column-store.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useBoardStore } from "@/entities/board/model/store";
import type { BoardWithColumns, ColumnWithCards } from "@/shared/types/database";

function col(id: string, name: string, position: string): ColumnWithCards {
  return { id, board_id: "b", name, position, created_at: "", cards: [] };
}
function board(cols: ColumnWithCards[]): BoardWithColumns {
  return {
    id: "b", workspace_id: "w", name: "B", github_repo: null,
    created_at: "", columns: cols,
  };
}

describe("board store 컬럼 메서드", () => {
  beforeEach(() => {
    useBoardStore.getState().setBoard(
      board([col("c1", "To Do", "1"), col("c2", "Done", "2")]),
    );
  });

  it("renameColumnLocal 은 이름을 바꾸고 스냅샷을 반환", () => {
    const snap = useBoardStore.getState().renameColumnLocal("c1", "Backlog");
    expect(useBoardStore.getState().columns[0]?.name).toBe("Backlog");
    expect(snap[0]?.name).toBe("To Do"); // 스냅샷은 이전 값
  });

  it("removeColumnLocal 은 컬럼을 제거하고 스냅샷을 반환", () => {
    const snap = useBoardStore.getState().removeColumnLocal("c1");
    expect(useBoardStore.getState().columns.map((c) => c.id)).toEqual(["c2"]);
    expect(snap).toHaveLength(2);
  });

  it("reorderColumnLocal 은 컬럼을 toIndex 로 이동하고 position 을 갱신", () => {
    useBoardStore.getState().reorderColumnLocal("c2", 0, "0");
    const cols = useBoardStore.getState().columns;
    expect(cols.map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(cols[0]?.position).toBe("0");
  });

  it("restore 로 스냅샷 복원", () => {
    const snap = useBoardStore.getState().removeColumnLocal("c1");
    useBoardStore.getState().restore(snap);
    expect(useBoardStore.getState().columns).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run tests/unit/board-column-store.test.ts`
Expected: FAIL (`renameColumnLocal` 등 미정의).

- [ ] **Step 3: 스토어에 메서드 추가**

`BoardState` 인터페이스에 추가:

```ts
  renameColumnLocal: (id: string, name: string) => ColumnWithCards[];
  removeColumnLocal: (id: string) => ColumnWithCards[];
  reorderColumnLocal: (
    id: string,
    toIndex: number,
    position: string,
  ) => ColumnWithCards[];
```

구현(스토어 객체 안, `restore` 위에 추가). `clone` 헬퍼 재사용:

```ts
  renameColumnLocal: (id, name) => {
    const snapshot = clone(get().columns);
    set({
      columns: get().columns.map((c) =>
        c.id === id ? { ...c, name } : c,
      ),
    });
    return snapshot;
  },

  removeColumnLocal: (id) => {
    const snapshot = clone(get().columns);
    set({ columns: get().columns.filter((c) => c.id !== id) });
    return snapshot;
  },

  reorderColumnLocal: (id, toIndex, position) => {
    const snapshot = clone(get().columns);
    const next = clone(get().columns);
    const from = next.findIndex((c) => c.id === id);
    if (from === -1) return snapshot;
    const [moved] = next.splice(from, 1);
    if (!moved) return snapshot;
    moved.position = position;
    const clamped = Math.max(0, Math.min(toIndex, next.length));
    next.splice(clamped, 0, moved);
    set({ columns: next });
    return snapshot;
  },
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run tests/unit/board-column-store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 전체 검증 + Commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: 통과 (단위 7파일).

```bash
git add src/entities/board/model/store.ts tests/unit/board-column-store.test.ts
git commit -m "feat(board): 스토어 컬럼 rename/remove/reorder 낙관적 메서드(+테스트)"
```

---

## Task 3: 컬럼 액션 래퍼 훅

**Files:**
- Create: `src/features/column-edit/model/use-column-actions.ts`

- [ ] **Step 1: 작성**

추가/이름변경/삭제를 서버액션 + 토스트로 래핑. 실시간 구독이 `columns` 변경을 resync 하므로 별도 낙관적 처리 불필요(재정렬은 Task 5에서 별도 처리). 이름변경만 즉시 반영감을 위해 낙관적 + 실패 롤백.

```ts
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  createColumn,
  renameColumn,
  deleteColumn,
} from "@/entities/column/api/actions";
import { useBoardStore } from "@/entities/board/model/store";

export function useColumnActions(boardId: string) {
  const [pending, start] = useTransition();

  function add(name: string, afterPosition: string | null) {
    start(async () => {
      try {
        await createColumn(boardId, name, afterPosition);
        // 실시간 구독이 columns INSERT 를 resync.
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "컬럼 추가 실패");
      }
    });
  }

  function rename(id: string, name: string) {
    const snapshot = useBoardStore.getState().renameColumnLocal(id, name);
    start(async () => {
      try {
        await renameColumn(id, name, boardId);
      } catch (e) {
        useBoardStore.getState().restore(snapshot);
        toast.error(e instanceof Error ? e.message : "이름 변경 실패");
      }
    });
  }

  function remove(id: string) {
    const snapshot = useBoardStore.getState().removeColumnLocal(id);
    start(async () => {
      try {
        await deleteColumn(id, boardId);
      } catch (e) {
        useBoardStore.getState().restore(snapshot);
        toast.error(e instanceof Error ? e.message : "컬럼 삭제 실패");
      }
    });
  }

  return { pending, add, rename, remove };
}
```

- [ ] **Step 2: 검증 + Commit**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과.

```bash
git add src/features/column-edit/model/use-column-actions.ts
git commit -m "feat(column-edit): 컬럼 add/rename/remove 액션 래퍼 훅"
```

---

## Task 4: 컬럼 헤더(인라인 편집 + 메뉴) & 컬럼 추가 UI

**Files:**
- Create: `src/features/column-edit/ui/column-header.tsx`
- Create: `src/features/column-edit/ui/add-column.tsx`

- [ ] **Step 1: `column-header.tsx` 작성**

owner/admin(`canEdit`)일 때만 편집 가능. 더블클릭→인라인 input, ⋯ 메뉴(이름변경/삭제), 드래그 핸들(`dragHandleProps`는 Task 5에서 board-column이 주입). 삭제는 카드 0개일 때만 활성.

```tsx
"use client";

import { useState } from "react";
import { MoreHorizontal, GripVertical } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useColumnActions } from "../model/use-column-actions";

export function ColumnHeader({
  columnId,
  name,
  count,
  boardId,
  canEdit,
  dragHandle,
}: {
  columnId: string;
  name: string;
  count: number;
  boardId: string;
  canEdit: boolean;
  dragHandle?: React.ReactNode;
}) {
  const { rename, remove } = useColumnActions(boardId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  function commit() {
    const value = draft.trim();
    setEditing(false);
    if (value && value !== name) rename(columnId, value);
    else setDraft(name);
  }

  if (!canEdit) {
    return (
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-[13px] font-semibold text-foreground">{name}</h3>
        <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1 px-2 py-2">
      {dragHandle && (
        <span className="cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
          {dragHandle}
        </span>
      )}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[13px] font-semibold text-foreground focus:border-primary/60 focus:outline-none"
        />
      ) : (
        <h3
          onDoubleClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          className="flex-1 cursor-text truncate text-[13px] font-semibold text-foreground"
          title="더블클릭하여 이름 변경"
        >
          {name}
        </h3>
      )}
      <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
        {count}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-surface-2 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="컬럼 메뉴"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
          >
            이름 변경
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={count > 0}
            onClick={() => count === 0 && remove(columnId)}
            className={cn(count === 0 && "text-destructive focus:text-destructive")}
          >
            {count > 0 ? "삭제 (카드 비우기 먼저)" : "삭제"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

> 주의: `DropdownMenuItem`이 `disabled` prop을 지원하는지 `src/shared/ui/dropdown-menu.tsx`에서 확인. Radix 기반이면 지원함. 미지원 시 `data-disabled` 또는 조건부 비렌더로 대체.

- [ ] **Step 2: `add-column.tsx` 작성**

`add-card.tsx`의 open/transition/Enter·Esc 패턴을 그대로 따른다.

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useColumnActions } from "../model/use-column-actions";

export function AddColumn({
  boardId,
  lastPosition,
}: {
  boardId: string;
  lastPosition: string | null;
}) {
  const { add, pending } = useColumnActions(boardId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function submit() {
    const value = name.trim();
    if (!value) return;
    add(value, lastPosition);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-[280px] shrink-0 items-center gap-2 rounded-xl border border-dashed border-border px-3 text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
      >
        <Plus className="h-4 w-4" /> 컬럼 추가
      </button>
    );
  }

  return (
    <div className="w-[280px] shrink-0 rounded-xl border border-border bg-surface/60 p-2">
      <Input
        autoFocus
        value={name}
        placeholder="컬럼 이름"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending}>
          추가
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          취소
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 검증 + Commit**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과.

```bash
git add src/features/column-edit/ui/column-header.tsx src/features/column-edit/ui/add-column.tsx
git commit -m "feat(column-edit): 컬럼 헤더 인라인 편집·메뉴 + 컬럼 추가 UI"
```

---

## Task 5: 컬럼 정렬 dnd 배선 + 보드 통합

**Files:**
- Modify: `src/widgets/board-view/ui/board-column.tsx`
- Modify: `src/widgets/board-view/ui/board-view.tsx`
- Modify: `src/features/card-drag/model/use-card-dnd.ts`

- [ ] **Step 1: `board-column.tsx` — useSortable(컬럼) + ColumnHeader 적용**

기존 droppable(`type: "column"`, 카드 드롭용)은 유지하고, **컬럼 정렬용 sortable**을 추가(`type: "column-sort"`). 헤더를 `ColumnHeader`로 교체하고 드래그 핸들에 listeners 연결. props에 `canEdit` 추가.

```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { AddCard } from "@/features/card-create/ui/add-card";
import { ColumnHeader } from "@/features/column-edit/ui/column-header";
import { CardItem } from "./card-item";
import type { ColumnWithCards } from "@/shared/types/database";

export function BoardColumn({
  column,
  boardId,
  canEdit,
}: {
  column: ColumnWithCards;
  boardId: string;
  canEdit: boolean;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const {
    setNodeRef: setSortRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `colsort-${column.id}`,
    data: { type: "column-sort", columnId: column.id },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setSortRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex max-h-full w-[280px] shrink-0 flex-col rounded-xl border border-border bg-surface/60 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <ColumnHeader
        columnId={column.id}
        name={column.name}
        count={column.cards.length}
        boardId={boardId}
        canEdit={canEdit}
        dragHandle={
          canEdit ? (
            <span {...attributes} {...listeners}>
              <GripVertical className="h-4 w-4" />
            </span>
          ) : undefined
        }
      />
      <div
        ref={setDropRef}
        className={`min-h-[60px] space-y-2 overflow-y-auto px-2 pb-2 transition-shadow ${
          isOver ? "rounded-lg ring-2 ring-primary/40" : ""
        }`}
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <CardItem key={card.id} card={card} boardId={boardId} />
          ))}
        </SortableContext>
      </div>
      <div className="p-2">
        <AddCard columnId={column.id} boardId={boardId} />
      </div>
    </div>
  );
}
```

> 주의: 컬럼 sortable id를 `colsort-<id>`로 prefix해 카드 id와 절대 충돌하지 않게 한다. `data.columnId`로 실제 컬럼 식별.

- [ ] **Step 2: `use-card-dnd.ts` — onDragEnd에 컬럼 분기 추가**

함수 최상단에서 `active.data.current?.type`을 보고 컬럼이면 컬럼 재정렬, 아니면 기존 카드 로직. 컬럼 재정렬은 `between()`으로 새 position 계산 → `reorderColumn` → 낙관적 `reorderColumnLocal`.

기존 import에 추가:
```ts
import { reorderColumn } from "@/entities/column/api/actions";
```
(`between`은 클라에서 호출하지 않는다 — `reorderColumn` 서버액션이 내부에서 `between(beforePosition, afterPosition)`을 호출한다.)

`onDragEnd` 함수 본문 맨 앞(`if (!over) return;` 다음)에 삽입:

```ts
    // 컬럼 재정렬 분기 (active 가 컬럼 핸들일 때)
    if (active.data.current?.type === "column-sort") {
      const cols = useBoardStore.getState().columns;
      const activeColId = String(active.data.current.columnId);
      const overColId = String(over.data.current?.columnId ?? "");
      if (!overColId || activeColId === overColId) return;

      const fromIdx = cols.findIndex((c) => c.id === activeColId);
      const toIdx = cols.findIndex((c) => c.id === overColId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

      // active 를 뺀 순서에서 toIdx 자리에 끼울 때의 양옆 컬럼 position.
      const without = cols.filter((c) => c.id !== activeColId);
      const before = toIdx > 0 ? (without[toIdx - 1]?.position ?? null) : null;
      const after = without[toIdx]?.position ?? null;

      // 낙관 이동: 정확 position 은 서버가 between 으로 계산 → 실시간 resync 가 정정.
      // 임시 position 으로 after(없으면 before)를 사용해 즉시 순서만 반영.
      const snapshot = useBoardStore
        .getState()
        .reorderColumnLocal(activeColId, toIdx, after ?? before ?? "");
      try {
        await reorderColumn({
          id: activeColId,
          beforePosition: before,
          afterPosition: after,
          boardId,
        });
      } catch (e) {
        useBoardStore.getState().restore(snapshot);
        toast.error(e instanceof Error ? e.message : "컬럼 이동 실패");
      }
      return;
    }
```

> 설계 의도: 클라는 양옆 컬럼 position(`before`/`after`)만 `reorderColumn`에 넘기고, 정확한 새 position은 서버액션이 `between()`으로 계산한다. 낙관적 `reorderColumnLocal`은 순서만 즉시 반영(임시 position)하고, `columns` 실시간 구독의 디바운스 resync가 서버의 정확 position으로 정정한다. `toast`는 이 파일에 이미 import 되어 있다(카드 이동에서 사용 중).

- [ ] **Step 3: `board-view.tsx` — 수평 SortableContext + canEdit 전달**

`BoardView`에 `canEdit` prop 추가, 컬럼들을 수평 SortableContext로 감싸고 AddColumn 추가.

```tsx
// import 추가
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AddColumn } from "@/features/column-edit/ui/add-column";

// 시그니처
export function BoardView({
  initial,
  canEdit,
}: {
  initial: BoardWithColumns;
  canEdit: boolean;
}) {
```

board 모드의 컬럼 렌더 부분을 교체:

```tsx
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={onDragEnd}
        >
          <div className="flex h-full items-start gap-4 overflow-x-auto p-6">
            <SortableContext
              items={columns.map((c) => `colsort-${c.id}`)}
              strategy={horizontalListSortingStrategy}
            >
              {columns.map((col) => (
                <BoardColumn
                  key={col.id}
                  column={col}
                  boardId={initial.id}
                  canEdit={canEdit}
                />
              ))}
            </SortableContext>
            {canEdit && (
              <AddColumn
                boardId={initial.id}
                lastPosition={
                  columns.length ? columns[columns.length - 1]!.position : null
                }
              />
            )}
          </div>
        </DndContext>
```

- [ ] **Step 4: `board/[boardId]/page.tsx` — role 조회 후 canEdit 전달**

```tsx
import { getMyBoardRole } from "@/entities/board/api/role";

// 기존 Promise.all 에 role 추가
  const [board, user, role] = await Promise.all([
    getBoardWithColumnsAndCards(params.boardId),
    getCurrentUser(),
    getMyBoardRole(params.boardId),
  ]);
  if (!board) notFound();
  const canEdit = role === "owner" || role === "admin";

// BoardView 호출에 canEdit 전달
      <BoardView initial={board} canEdit={canEdit} />
```

- [ ] **Step 5: 검증**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: 통과 (35 + 새 컬럼 스토어 테스트).

- [ ] **Step 6: dev 프리뷰 검수**

owner 계정으로 보드 진입 → (1) `+ 컬럼 추가`로 컬럼 생성, (2) 헤더 더블클릭으로 이름변경, (3) 빈 컬럼 ⋯ → 삭제, 카드 있는 컬럼은 삭제 비활성 확인, (4) GripVertical 핸들로 컬럼 좌우 드래그 재정렬, (5) 카드 드래그가 여전히 정상인지. 콘솔 에러 0.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/board-view/ui/board-column.tsx src/widgets/board-view/ui/board-view.tsx src/features/card-drag/model/use-card-dnd.ts "src/app/(main)/board/[boardId]/page.tsx"
git commit -m "feat(column-edit): 컬럼 정렬 dnd + 보드 통합 + 권한 게이팅"
```

---

## Task 6: deleteColumn 카드-존재 서버 가드

**Files:**
- Modify: `src/entities/column/api/actions.ts` (deleteColumn)

- [ ] **Step 1: 가드 추가**

`deleteColumn`이 카드가 남아있으면 거부(cascade 사고 방지). 기존 함수 본문을 교체:

```ts
export async function deleteColumn(id: string, boardId: string) {
  const { supabase } = await requireUser();
  const { count } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("column_id", id);
  if ((count ?? 0) > 0) {
    throw new Error("카드가 있는 컬럼은 삭제할 수 없습니다. 먼저 카드를 옮기거나 삭제하세요.");
  }
  const { error } = await supabase.from("columns").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${boardId}`);
}
```

- [ ] **Step 2: 검증 + Commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: 통과.

```bash
git add src/entities/column/api/actions.ts
git commit -m "feat(column): deleteColumn 카드-존재 가드 (데이터 안전)"
```

---

## Self-Review 결과 (작성자 점검)

- **스펙 커버리지:** 인라인 편집(T4)·삭제 가드 UI(T4)+서버(T6)·owner/admin 권한(T1,T5)·재정렬 dnd(T2,T5)·서버액션 재사용(T3,T5)·스토어 메서드(T2)·role 전달(T1,T5) — 스펙 섹션 2~7 전부 매핑.
- **확정 기본값 반영:** 추가=실시간 resync(낙관 없음, T3) / deleteColumn 서버 가드(T6). 둘 다 반영.
- **타입 일관성:** `renameColumnLocal`/`removeColumnLocal`/`reorderColumnLocal`(T2) ↔ `useColumnActions`(T3) ↔ ColumnHeader(T4); `canEdit`(T1 role → T5 page → board-view → board-column → column-header) 단일 경로; sortable id `colsort-<id>` prefix로 카드 id 충돌 회피(T5 일관).
- **dnd 충돌:** 카드 sortable(card.id) vs 컬럼 sortable(`colsort-`+id), droppable(column.id) — id 네임스페이스 분리됨. onDragEnd가 `data.current.type`으로 분기.
- **알려진 주의:** T5 Step2의 position 계산은 권장(단순) 버전 사용 — 클라 `between` 제거, 낙관 이동은 임시 position + 서버/resync 정정. T4의 `DropdownMenuItem disabled` 지원 확인.
