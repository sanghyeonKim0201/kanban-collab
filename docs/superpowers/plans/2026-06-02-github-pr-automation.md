# GitHub PR 워크플로우 자동화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub PR 상태 변화(opened/reopened/merged)에 따라 링크된 칸반 카드를 보드별 설정 매핑대로 컬럼 간 자동 이동시키고, 실시간 반영·PR 상태 배지·자동화 토스트/활동 피드로 시연에서 눈에 보이게 만든다.

**Architecture:** 기존 `/api/webhooks/github` 라우트에 PR 자동화 분기를 추가한다. 이동 판정은 순수 함수(`resolvePrTransition`/`pickTargetColumn`/`prBadgeState`)로 분리해 TDD하고, 라우트는 admin(service_role) 클라이언트로 카드 조회·이동·`board_activity` 적재 I/O만 담당한다. 클라이언트는 기존 `useBoardRealtime`(cards CDC)로 카드 이동을 받고, 신규 `board_activity` 구독으로 토스트·피드를 갱신한다.

**Tech Stack:** Next.js 14 App Router, Supabase(Postgres+RLS+Realtime), TypeScript, zustand, sonner, vitest, pnpm, FSD.

---

## File Structure

```
신규:
  supabase/migrations/0003_pr_automation.sql              # 스키마(boards/cards 컬럼, board_activity, RLS, realtime)
  src/features/pr-automation/model/transition.ts          # 순수 함수 3종
  tests/unit/pr-automation-transition.test.ts             # 순수 함수 테스트
  src/features/pr-automation/ui/pr-status-badge.tsx        # PR 상태 배지(open/merged/closed)
  src/features/pr-automation/ui/card-github-url-input.tsx  # 카드 상세 PR URL 입력
  src/features/pr-automation/ui/pr-automation-settings.tsx # 보드별 매핑 설정(토글+드롭다운2)
  src/features/pr-automation/model/use-board-activity.ts   # board_activity 구독 → 토스트 + 최근목록
  src/entities/board/api/activity.ts                       # board_activity 조회(server-only)

변경:
  src/shared/types/database.ts                  # Board/Card 신규 필드 + BoardActivity 타입
  src/app/api/webhooks/github/route.ts          # PR 자동화 분기 추가, board select 확장
  src/entities/board/api/queries.ts             # 카드 enrich 에 github_pr_state 포함
  src/entities/board/api/actions.ts             # setPrAutomation 서버 액션 추가
  src/entities/card/api/actions.ts              # (확인용) updateCard 가 github_url 받음 — 변경 없을 수 있음
  src/widgets/card-detail-panel/ui/card-detail.tsx   # PR URL 입력 + 상태 배지
  src/widgets/board-view/ui/board-card.tsx           # 카드칩에 PR 상태 배지
  src/widgets/board-view/ui/board-view.tsx           # 활동 구독 마운트 + 컨텍스트 패널에 props 전달
  src/widgets/board-view/ui/board-context-panel.tsx  # 자동화 설정 + 활동 피드
```

설계 원칙: 자동화 판정 로직(순수)과 I/O(라우트)를 분리해 테스트 가능하게 한다. UI는 feature 슬라이스(`pr-automation`)에 모으고 위젯에서 조립한다.

---

## Task 1: DB 마이그레이션 + 타입

**Files:**
- Create: `supabase/migrations/0003_pr_automation.sql`
- Modify: `src/shared/types/database.ts`

- [ ] **Step 1: 마이그레이션 SQL 작성**

Create `supabase/migrations/0003_pr_automation.sql`:

```sql
-- boards: 보드별 PR→컬럼 매핑 + 자동화 토글
alter table public.boards
  add column pr_automation_enabled boolean not null default false,
  add column pr_open_column_id uuid references public.columns(id) on delete set null,
  add column pr_merged_column_id uuid references public.columns(id) on delete set null;

-- cards: PR 상태 배지용
alter table public.cards
  add column github_pr_state text
    check (github_pr_state in ('open','merged','closed'));

-- 자동화 활동 로그 (토스트·피드 소스)
create table public.board_activity (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  kind text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index board_activity_board_created_idx
  on public.board_activity(board_id, created_at desc);

-- RLS: 워크스페이스 멤버만 조회. INSERT 정책 없음 → service_role(웹훅)만 삽입.
alter table public.board_activity enable row level security;

create policy "board_activity_select" on public.board_activity
  for select using (
    exists (
      select 1 from public.boards b
      where b.id = board_activity.board_id
        and public.is_workspace_member(b.workspace_id)
    )
  );

-- 실시간 구독 대상에 추가 (cards/columns 는 0001/0002 에서 이미 포함)
alter publication supabase_realtime add table public.board_activity;
```

적용 시 확인: `is_workspace_member(uuid)` 헬퍼가 `0002_rls.sql` 에 존재해야 한다(없으면 0002 의 멤버십 판정 헬퍼명으로 교체). `supabase_realtime` 퍼블리케이션명이 0001/0002 와 동일한지 확인.

- [ ] **Step 2: 마이그레이션 적용**

Supabase MCP `apply_migration`(name: `0003_pr_automation`) 또는 SQL 에디터로 적용. 에러 없이 완료 확인.

- [ ] **Step 3: DB 타입 갱신**

Modify `src/shared/types/database.ts`:

`Board` 인터페이스에 필드 추가:

```ts
export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  github_repo: string | null;
  pr_automation_enabled: boolean;
  pr_open_column_id: string | null;
  pr_merged_column_id: string | null;
  created_at: string;
}
```

`Card` 인터페이스에 필드 추가(`github_url` 바로 아래):

```ts
  github_url: string | null;
  github_pr_state: "open" | "merged" | "closed" | null;
```

파일 끝 합성 타입 위(예: `GithubEvent` 아래)에 추가:

```ts
export interface BoardActivity {
  id: string;
  board_id: string;
  card_id: string | null;
  kind: string;
  message: string;
  created_at: string;
}
```

- [ ] **Step 4: 타입체크**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (아직 신규 필드 미사용이라 에러 없음)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_pr_automation.sql src/shared/types/database.ts
git commit -m "feat(pr-automation): 스키마(boards 매핑·cards pr상태·board_activity) + 타입"
```

---

## Task 2: 순수 전이 로직 (TDD)

**Files:**
- Create: `src/features/pr-automation/model/transition.ts`
- Test: `tests/unit/pr-automation-transition.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/unit/pr-automation-transition.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  resolvePrTransition,
  pickTargetColumn,
  prBadgeState,
} from "@/features/pr-automation/model/transition";

describe("resolvePrTransition", () => {
  test("opened → open", () => {
    expect(resolvePrTransition("opened", false)).toBe("open");
  });
  test("reopened → open", () => {
    expect(resolvePrTransition("reopened", false)).toBe("open");
  });
  test("closed + merged → done", () => {
    expect(resolvePrTransition("closed", true)).toBe("done");
  });
  test("closed + 미머지 → null", () => {
    expect(resolvePrTransition("closed", false)).toBeNull();
  });
  test("synchronize/기타 → null", () => {
    expect(resolvePrTransition("synchronize", false)).toBeNull();
    expect(resolvePrTransition("edited", false)).toBeNull();
  });
});

describe("pickTargetColumn", () => {
  const board = {
    pr_automation_enabled: true,
    pr_open_column_id: "col-open",
    pr_merged_column_id: "col-done",
  };
  test("open 전이 → open 컬럼", () => {
    expect(pickTargetColumn(board, "open")).toBe("col-open");
  });
  test("done 전이 → merged 컬럼", () => {
    expect(pickTargetColumn(board, "done")).toBe("col-done");
  });
  test("비활성화 → null", () => {
    expect(pickTargetColumn({ ...board, pr_automation_enabled: false }, "open")).toBeNull();
  });
  test("매핑 null → null", () => {
    expect(pickTargetColumn({ ...board, pr_open_column_id: null }, "open")).toBeNull();
  });
  test("전이 null → null", () => {
    expect(pickTargetColumn(board, null)).toBeNull();
  });
});

describe("prBadgeState", () => {
  test("opened → open", () => {
    expect(prBadgeState("opened", false)).toBe("open");
  });
  test("closed + merged → merged", () => {
    expect(prBadgeState("closed", true)).toBe("merged");
  });
  test("closed + 미머지 → closed", () => {
    expect(prBadgeState("closed", false)).toBe("closed");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/unit/pr-automation-transition.test.ts`
Expected: FAIL ("Cannot find module '@/features/pr-automation/model/transition'")

- [ ] **Step 3: 구현**

Create `src/features/pr-automation/model/transition.ts`:

```ts
/** PR 상태 변화 → 이동 의도. null 이면 이동 안 함(배지만 갱신). */
export type PrTransition = "open" | "done" | null;

/** 카드 PR 상태 배지 값. */
export type PrBadgeState = "open" | "merged" | "closed";

/**
 * GitHub pull_request 이벤트의 action/merged 로 이동 의도를 판정한다.
 * opened/reopened → 'open', closed+merged → 'done', 그 외 → null.
 */
export function resolvePrTransition(action: string, merged: boolean): PrTransition {
  if (action === "opened" || action === "reopened") return "open";
  if (action === "closed" && merged) return "done";
  return null;
}

/** 보드 매핑에서 전이에 해당하는 목표 column_id. 비활성/매핑없음 → null. */
export function pickTargetColumn(
  board: {
    pr_automation_enabled: boolean;
    pr_open_column_id: string | null;
    pr_merged_column_id: string | null;
  },
  transition: PrTransition,
): string | null {
  if (!board.pr_automation_enabled) return null;
  if (transition === "open") return board.pr_open_column_id;
  if (transition === "done") return board.pr_merged_column_id;
  return null;
}

/** 카드 배지에 표시할 PR 상태. */
export function prBadgeState(action: string, merged: boolean): PrBadgeState {
  if (action === "closed" && merged) return "merged";
  if (action === "closed") return "closed";
  return "open";
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run tests/unit/pr-automation-transition.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/pr-automation/model/transition.ts tests/unit/pr-automation-transition.test.ts
git commit -m "feat(pr-automation): 전이 판정 순수 함수 + 테스트"
```

---

## Task 3: 웹훅 PR 자동화 분기

**Files:**
- Modify: `src/app/api/webhooks/github/route.ts`

기존 라우트는 시그니처 검증·보드 식별·`github_events` 적재·`#CARD` → `github_url` 연결을 한다. 여기에 (1) board select 확장, (2) pull_request 자동화 블록을 추가한다. `#CARD` 링크는 유지하되 자동화 블록을 그 뒤에 둬, 같은 이벤트에서 막 링크된 카드도 매칭되게 한다.

- [ ] **Step 1: import 추가**

`src/app/api/webhooks/github/route.ts` 상단 import 에 추가:

```ts
import { between } from "@/shared/lib/lexorank";
import {
  resolvePrTransition,
  pickTargetColumn,
  prBadgeState,
} from "@/features/pr-automation/model/transition";
```

- [ ] **Step 2: board select 확장**

같은 파일에서 board 조회(현재 `.select("id")`)를 매핑 필드 포함으로 교체:

```ts
  const { data: board } = await admin
    .from("boards")
    .select(
      "id, pr_automation_enabled, pr_open_column_id, pr_merged_column_id",
    )
    .eq("github_repo", repo)
    .maybeSingle();
  if (!board) {
    return NextResponse.json({ ok: true, skipped: "repo not linked" });
  }
```

- [ ] **Step 3: payload 타입에 number/merged 추가**

같은 파일의 `payload` 캐스팅 타입에서 `pull_request` 항목을 확장:

```ts
    pull_request?: {
      body?: string | null;
      html_url: string;
      state: string;
      number?: number;
      merged?: boolean;
    };
```

- [ ] **Step 4: 자동화 블록 추가**

기존 `else if (event === "pull_request" && payload.pull_request) { ... }` 블록의 닫는 `}` **직후**(이슈 주석 위)에 자동화 처리를 추가한다. 즉 PR 본문 `#CARD` 링크가 끝난 뒤 실행:

```ts
    // PR 자동화: github_url 로 링크된 카드를 매핑 컬럼으로 이동 + 상태 배지 + 활동 로그
    if (event === "pull_request" && payload.pull_request) {
      const pr = payload.pull_request;
      const action = payload.action ?? "";
      const merged = pr.merged === true;
      const badge = prBadgeState(action, merged);
      const transition = resolvePrTransition(action, merged);

      // 이 보드의 컬럼(이름 포함) — 매칭 범위 한정 + 활동 메시지용 이름
      const { data: boardCols } = await admin
        .from("columns")
        .select("id, name")
        .eq("board_id", board.id);
      const colIds = (boardCols ?? []).map((c) => c.id);

      const { data: linkedCards } = colIds.length
        ? await admin
            .from("cards")
            .select("id, title, column_id")
            .eq("github_url", pr.html_url)
            .in("column_id", colIds)
        : { data: [] as { id: string; title: string; column_id: string }[] };

      const targetColId = pickTargetColumn(board, transition);

      for (const card of linkedCards ?? []) {
        const update: { github_pr_state: string; column_id?: string; position?: string } = {
          github_pr_state: badge,
        };
        let movedToName: string | null = null;

        if (targetColId && card.column_id !== targetColId) {
          const { data: lastCard } = await admin
            .from("cards")
            .select("position")
            .eq("column_id", targetColId)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();
          update.column_id = targetColId;
          update.position = between(lastCard?.position ?? null, null);
          movedToName =
            (boardCols ?? []).find((c) => c.id === targetColId)?.name ?? null;
        }

        await admin.from("cards").update(update).eq("id", card.id);

        if (movedToName) {
          const verb = transition === "done" ? "머지됨" : "열림";
          await admin.from("board_activity").insert({
            board_id: board.id,
            card_id: card.id,
            kind: "pr_automation",
            message: `🤖 PR #${pr.number ?? "?"} ${verb} → '${card.title}'을(를) ${movedToName}(으)로 이동`,
          });
        }
      }
    }
```

- [ ] **Step 5: 타입체크**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 6: 기존 테스트 회귀 확인**

Run: `pnpm test`
Expected: PASS (기존 + Task 2 테스트 전부 그린)

- [ ] **Step 7: Commit**

```bash
git add src/app/api/webhooks/github/route.ts
git commit -m "feat(pr-automation): 웹훅 PR 자동화 분기 — 카드 이동·상태·활동로그"
```

---

## Task 4: 카드 PR URL 입력 + 상태 배지

**Files:**
- Create: `src/features/pr-automation/ui/pr-status-badge.tsx`
- Create: `src/features/pr-automation/ui/card-github-url-input.tsx`
- Modify: `src/entities/board/api/queries.ts`
- Modify: `src/widgets/card-detail-panel/ui/card-detail.tsx`
- Modify: `src/widgets/board-view/ui/board-card.tsx`

- [ ] **Step 1: 카드 enrich 에 github_pr_state 포함**

Modify `src/entities/board/api/queries.ts` — 카드 enrich 객체(`ai_category` 아래, `github_url` 다음)에 한 줄 추가:

```ts
      github_url: card.github_url,
      github_pr_state: card.github_pr_state,
```

(cards select 는 `*` 이라 데이터는 이미 포함됨.)

- [ ] **Step 2: 상태 배지 컴포넌트**

Create `src/features/pr-automation/ui/pr-status-badge.tsx`:

```tsx
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
```

- [ ] **Step 3: 카드칩에 배지 추가**

Modify `src/widgets/board-view/ui/board-card.tsx`: 기존 배지(priority/AI) 가 있는 줄에 `PrStatusBadge` 를 추가한다. 파일 상단 import 추가:

```tsx
import { PrStatusBadge } from "@/features/pr-automation/ui/pr-status-badge";
```

그리고 priority/AI 배지가 나열되는 컨테이너 안에 추가(예: AI 배지 옆):

```tsx
        <PrStatusBadge state={card.github_pr_state} />
```

(`card` 가 `CardWithRelations` 이므로 `github_pr_state` 사용 가능. 실제 배지 컨테이너 위치는 기존 priority/`ai_category` 배지가 렌더되는 곳을 따른다.)

- [ ] **Step 4: PR URL 입력 컴포넌트**

Create `src/features/pr-automation/ui/card-github-url-input.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateCard } from "@/entities/card/api/actions";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";

export function CardGithubUrlInput({
  cardId,
  boardId,
  initialUrl,
}: {
  cardId: string;
  boardId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = url.trim();
    setSaving(true);
    try {
      await updateCard({
        id: cardId,
        boardId,
        github_url: value === "" ? null : value,
      });
      toast.success("PR 링크 저장됨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        value={url}
        placeholder="https://github.com/owner/repo/pull/42"
        onChange={(e) => setUrl(e.target.value)}
      />
      <Button size="sm" onClick={save} disabled={saving}>
        저장
      </Button>
    </div>
  );
}
```

적용 전 확인: `updateCard` 의 시그니처가 `{ id, boardId, github_url? }` 형태인지 `src/entities/card/api/actions.ts` 에서 확인하고, 인자 형태(객체 vs 개별 인자)를 실제 시그니처에 맞춘다. zod 스키마에 `github_url: z.string().url().nullable().optional()` 이 이미 있다(스펙 확인됨).

- [ ] **Step 5: 카드 상세에 입력 + 배지 연결**

Modify `src/widgets/card-detail-panel/ui/card-detail.tsx`: 기존 `card.github_url` 표시 블록(약 179–186행) 근처에 PR 상태 배지와 URL 입력을 추가. 상단 import:

```tsx
import { PrStatusBadge } from "@/features/pr-automation/ui/pr-status-badge";
import { CardGithubUrlInput } from "@/features/pr-automation/ui/card-github-url-input";
```

기존 github_url 링크 표시 아래에:

```tsx
        <PrStatusBadge state={card.github_pr_state} />
        <CardGithubUrlInput
          cardId={card.id}
          boardId={boardId}
          initialUrl={card.github_url}
        />
```

(`card-detail.tsx` 가 `boardId` 를 prop/context 로 갖고 있는지 확인하고, 없으면 카드의 컬럼→보드 경로 또는 이미 전달되는 boardId 를 사용한다. 카드 타입에 `github_pr_state` 가 포함되도록 detail 조회도 필드를 포함해야 함 — `src/entities/card/api/detail.ts` 의 select/매핑에 `github_pr_state` 추가.)

- [ ] **Step 6: detail 조회에 필드 포함**

Modify `src/entities/card/api/detail.ts`: select 가 `*` 이 아니면 `github_pr_state` 를 추가하고, 반환 매핑(약 65행 `github_url: c.github_url,` 근처)에 추가:

```ts
      github_url: c.github_url,
      github_pr_state: c.github_pr_state,
```

- [ ] **Step 7: 타입체크 + 빌드 확인**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/features/pr-automation/ui/pr-status-badge.tsx src/features/pr-automation/ui/card-github-url-input.tsx src/entities/board/api/queries.ts src/entities/card/api/detail.ts src/widgets/card-detail-panel/ui/card-detail.tsx src/widgets/board-view/ui/board-card.tsx
git commit -m "feat(pr-automation): PR 상태 배지 + 카드 PR URL 입력"
```

---

## Task 5: 보드별 PR 자동화 설정 UI

**Files:**
- Modify: `src/entities/board/api/actions.ts`
- Create: `src/features/pr-automation/ui/pr-automation-settings.tsx`
- Modify: `src/widgets/board-view/ui/board-view.tsx`
- Modify: `src/widgets/board-view/ui/board-context-panel.tsx`

- [ ] **Step 1: 저장 서버 액션**

Modify `src/entities/board/api/actions.ts` — 파일 끝에 추가(상단 import 에 `getMyBoardRole`, `requireUser`, `revalidatePath` 가 없으면 추가):

```ts
import { getMyBoardRole } from "@/entities/board/api/role";

export async function setPrAutomation(input: {
  boardId: string;
  enabled: boolean;
  openColumnId: string | null;
  mergedColumnId: string | null;
}) {
  const { supabase } = await requireUser();
  const role = await getMyBoardRole(input.boardId);
  if (role !== "owner" && role !== "admin") {
    throw new Error("권한이 없습니다 (owner/admin 만 설정 가능).");
  }
  const { error } = await supabase
    .from("boards")
    .update({
      pr_automation_enabled: input.enabled,
      pr_open_column_id: input.openColumnId,
      pr_merged_column_id: input.mergedColumnId,
    })
    .eq("id", input.boardId);
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${input.boardId}`);
}
```

(기존 `actions.ts` 의 import 스타일을 따른다. `requireUser`, `revalidatePath` 가 이미 있으면 중복 추가하지 말 것.)

- [ ] **Step 2: 설정 컴포넌트**

Create `src/features/pr-automation/ui/pr-automation-settings.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setPrAutomation } from "@/entities/board/api/actions";
import { Button } from "@/shared/ui/button";

type Col = { id: string; name: string };

/** 이름 휴리스틱으로 기본 매핑 추천(미설정 시). */
function suggest(cols: Col[], kind: "open" | "done"): string | null {
  const keys = kind === "open" ? ["진행", "progress", "doing"] : ["완료", "done", "complete"];
  const hit = cols.find((c) => keys.some((k) => c.name.toLowerCase().includes(k.toLowerCase())));
  return hit?.id ?? null;
}

export function PrAutomationSettings({
  boardId,
  canEdit,
  columns,
  initial,
}: {
  boardId: string;
  canEdit: boolean;
  columns: Col[];
  initial: {
    enabled: boolean;
    openColumnId: string | null;
    mergedColumnId: string | null;
  };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [openCol, setOpenCol] = useState(initial.openColumnId ?? suggest(columns, "open") ?? "");
  const [mergedCol, setMergedCol] = useState(
    initial.mergedColumnId ?? suggest(columns, "done") ?? "",
  );
  const [saving, setSaving] = useState(false);

  if (!canEdit) return null;

  async function save() {
    setSaving(true);
    try {
      await setPrAutomation({
        boardId,
        enabled,
        openColumnId: openCol || null,
        mergedColumnId: mergedCol || null,
      });
      toast.success("PR 자동화 설정 저장됨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">PR 자동화</span>
        <label className="flex items-center gap-1.5 text-[13px]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          사용
        </label>
      </div>
      <div className="space-y-2">
        <label className="block text-[12px] text-muted-foreground">
          PR 열림 →
          <select
            value={openCol}
            onChange={(e) => setOpenCol(e.target.value)}
            className="ml-2 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[13px] text-foreground"
          >
            <option value="">없음</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] text-muted-foreground">
          PR 머지 →
          <select
            value={mergedCol}
            onChange={(e) => setMergedCol(e.target.value)}
            className="ml-2 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[13px] text-foreground"
          >
            <option value="">없음</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>
      <Button size="sm" onClick={save} disabled={saving} className="mt-3">
        저장
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: BoardView 에서 매핑·권한을 컨텍스트 패널로 전달**

Modify `src/widgets/board-view/ui/board-view.tsx`: `secondary={<BoardContextPanel />}` 를 매핑/권한 prop 전달로 교체:

```tsx
      secondary={
        <BoardContextPanel
          boardId={initial.id}
          canEdit={canEdit}
          prAutomation={{
            enabled: initial.pr_automation_enabled,
            openColumnId: initial.pr_open_column_id,
            mergedColumnId: initial.pr_merged_column_id,
          }}
        />
      }
```

(`initial` 은 `BoardWithColumns` 이고 Task 1 에서 매핑 필드가 `Board` 에 추가됐으므로 접근 가능.)

- [ ] **Step 4: 컨텍스트 패널에 설정 삽입**

Modify `src/widgets/board-view/ui/board-context-panel.tsx`: props 를 받고 컬럼 목록(store)으로 설정 컴포넌트를 렌더. 시그니처/상단 import 변경:

```tsx
import { PrAutomationSettings } from "@/features/pr-automation/ui/pr-automation-settings";

export function BoardContextPanel({
  boardId,
  canEdit,
  prAutomation,
}: {
  boardId: string;
  canEdit: boolean;
  prAutomation: {
    enabled: boolean;
    openColumnId: string | null;
    mergedColumnId: string | null;
  };
}) {
  const columns = useBoardStore((s) => s.columns);
  // ... 기존 progress/counts 계산 유지 ...
```

그리고 반환 JSX 의 마지막(상태별 분포 블록 아래)에 추가:

```tsx
      <PrAutomationSettings
        boardId={boardId}
        canEdit={canEdit}
        columns={columns.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          enabled: prAutomation.enabled,
          openColumnId: prAutomation.openColumnId,
          mergedColumnId: prAutomation.mergedColumnId,
        }}
      />
```

- [ ] **Step 5: 타입체크**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/entities/board/api/actions.ts src/features/pr-automation/ui/pr-automation-settings.tsx src/widgets/board-view/ui/board-view.tsx src/widgets/board-view/ui/board-context-panel.tsx
git commit -m "feat(pr-automation): 보드별 매핑 설정 UI + 저장 액션"
```

---

## Task 6: 활동 피드 + 토스트

**Files:**
- Create: `src/entities/board/api/activity.ts`
- Create: `src/features/pr-automation/model/use-board-activity.ts`
- Modify: `src/widgets/board-view/ui/board-view.tsx`
- Modify: `src/widgets/board-view/ui/board-context-panel.tsx`

- [ ] **Step 1: 초기 활동 조회(server-only)**

Create `src/entities/board/api/activity.ts`:

```ts
import "server-only";
import { createClient } from "@/shared/api/supabase/server";
import type { BoardActivity } from "@/shared/types/database";

export async function listBoardActivity(
  boardId: string,
  limit = 8,
): Promise<BoardActivity[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("board_activity")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
```

- [ ] **Step 2: 구독 훅 (토스트 + 최근목록)**

Create `src/features/pr-automation/model/use-board-activity.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/shared/api/supabase/client";
import { isSupabaseConfigured } from "@/shared/config/env";
import type { BoardActivity } from "@/shared/types/database";

/**
 * board_activity INSERT 구독 → 토스트 + 최근 목록 갱신.
 * 초기값(initial)은 RSC 에서 주입, 신규 insert 는 앞에 prepend.
 */
export function useBoardActivity(boardId: string, initial: BoardActivity[]) {
  const [items, setItems] = useState<BoardActivity[]>(initial);

  useEffect(() => {
    if (!isSupabaseConfigured() || !boardId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`board-activity:${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "board_activity",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const row = payload.new as BoardActivity;
          setItems((prev) => [row, ...prev].slice(0, 8));
          toast(row.message);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  return items;
}
```

- [ ] **Step 3: BoardView 에서 초기 활동 주입**

`getBoardWithColumnsAndCards` 를 호출하는 보드 페이지(`src/app/(main)/board/[boardId]/page.tsx`)에서 `listBoardActivity(boardId)` 를 병렬 호출해 `BoardView` 에 `initialActivity` prop 으로 전달한다. page.tsx 수정:

```tsx
import { listBoardActivity } from "@/entities/board/api/activity";
// ...
  const [board, activity] = await Promise.all([
    getBoardWithColumnsAndCards(boardId),
    listBoardActivity(boardId),
  ]);
  // board null 처리 기존 유지
  // <BoardView initial={board} canEdit={canEdit} initialActivity={activity} />
```

`BoardView` props 에 `initialActivity: BoardActivity[]` 추가하고 컨텍스트 패널로 전달:

```tsx
        <BoardContextPanel
          boardId={initial.id}
          canEdit={canEdit}
          prAutomation={{ /* 기존 */ }}
          initialActivity={initialActivity}
        />
```

- [ ] **Step 4: 컨텍스트 패널에서 훅 사용 + 피드 렌더**

`board-context-panel.tsx` 에 `initialActivity` prop 추가, 훅 호출, 피드 블록 렌더:

```tsx
import { useBoardActivity } from "@/features/pr-automation/model/use-board-activity";
// props 에 initialActivity: BoardActivity[] 추가 (타입 import)
  const activity = useBoardActivity(boardId, initialActivity);
```

설정 컴포넌트 아래에 피드 추가:

```tsx
      {activity.length > 0 && (
        <div>
          <div className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            자동화 활동
          </div>
          <div className="space-y-1">
            {activity.map((a) => (
              <div key={a.id} className="rounded-md px-2 py-1.5 text-[12px] text-muted-foreground">
                {a.message}
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 5: 타입체크 + 전체 테스트**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: PASS (전 테스트 그린)

- [ ] **Step 6: Commit**

```bash
git add src/entities/board/api/activity.ts src/features/pr-automation/model/use-board-activity.ts "src/app/(main)/board/[boardId]/page.tsx" src/widgets/board-view/ui/board-view.tsx src/widgets/board-view/ui/board-context-panel.tsx
git commit -m "feat(pr-automation): 자동화 활동 피드 + 실시간 토스트"
```

---

## Task 7: 라이브 검증 (수동)

**Files:** 없음 (검증만)

- [ ] **Step 1: 프리뷰 기동 + 로그인**

`preview_start`(kanban-collab) 후 데모 보드 진입. 인증 필요 시 별도 테스트 계정 세팅(이전 세션 방식).

- [ ] **Step 2: 설정 + 링크 준비**

보드 컨텍스트 패널에서 PR 자동화 "사용" 토글 ON, "PR 열림 → To Do/진행", "PR 머지 → Done/완료" 매핑 저장. 데모 카드 상세에서 PR URL(`https://github.com/<repo>/pull/1`) 입력·저장.

- [ ] **Step 3: opened 웹훅 모의 POST**

유효 시그니처로 `pull_request`(action=opened) payload 를 `/api/webhooks/github` 에 POST. payload 의 `repository.full_name` = 보드의 `github_repo`, `pull_request.html_url` = 카드에 링크한 URL, `pull_request.number` = 1, `merged` = false.

```bash
# secret 은 .env.local 의 GITHUB_WEBHOOK_SECRET
BODY='{"action":"opened","repository":{"full_name":"<repo>"},"pull_request":{"html_url":"https://github.com/<repo>/pull/1","state":"open","number":1,"merged":false}}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"
curl -s -X POST localhost:<port>/api/webhooks/github \
  -H "x-github-event: pull_request" -H "x-hub-signature-256: $SIG" \
  -H "content-type: application/json" -d "$BODY"
```

기대: 카드가 진행 컬럼으로 이동(실시간), 노랑 "PR 열림" 배지, 토스트/활동 피드에 "🤖 PR #1 열림 → ...".

- [ ] **Step 4: merged 웹훅 모의 POST**

같은 방식, `action=closed`, `merged=true`. 기대: 카드가 완료 컬럼으로 이동, 보라 "PR 머지" 배지, 토스트.

- [ ] **Step 5: 멱등 확인**

Step 4 payload 를 한 번 더 POST. 기대: 카드 위치 불변(이미 완료 컬럼), 중복 활동 로그는 생기되 이동은 없음(no-op). DB(`select column_id from cards ...`)로 확인.

- [ ] **Step 6: 미링크 카드 확인**

PR URL 안 붙인 카드는 어떤 이벤트에도 이동·배지 없음 확인.

---

## Self-Review (작성자 점검 완료)

**Spec coverage:**
- 보드별 매핑(스펙 2·4) → Task 1(스키마)·Task 5(UI/액션) ✔
- github_url 매칭(스펙 2·5) → Task 3 ✔
- opened→진행/merged→완료(스펙 5) → Task 2 `resolvePrTransition` ✔
- board_activity 토스트·피드(스펙 4·7c) → Task 1·6 ✔
- PR 상태 배지·PR URL 입력(스펙 7b) → Task 4 ✔
- 멱등·안전(스펙 6) → Task 3(no-op 가드)·Task 7(검증) ✔
- 테스트(스펙 8) → Task 2(단위)·Task 7(라이브) ✔

**Type consistency:** `PrTransition`('open'|'done'|null) 과 `PrBadgeState`('open'|'merged'|'closed') 는 의도적으로 분리(전이 vs 배지). `github_pr_state` 는 cards 컬럼·Card 타입·배지에서 'open'|'merged'|'closed' 로 일관. `setPrAutomation` 인자명(openColumnId/mergedColumnId)·`pickTargetColumn` 보드 필드명(pr_open_column_id/pr_merged_column_id) 사용처 일치.

**적용 시 확인 항목(코드 외 의존):**
- `is_workspace_member` 헬퍼명/`supabase_realtime` 퍼블리케이션명(Task 1).
- `updateCard` 실제 시그니처(Task 4 Step 4)·`card-detail.tsx` 의 `boardId` 가용성(Task 4 Step 5).
- `board/[boardId]/page.tsx` 의 기존 board null 분기 유지(Task 6 Step 3).
