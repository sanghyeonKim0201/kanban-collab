# GitHub PR 워크플로우 자동화 — 설계

작성일: 2026-06-02
상태: 승인됨 (브레인스토밍 완료, 구현 계획 대기)

## 1. 배경 / 목표

GitHub PR 상태 변화에 따라 칸반 카드를 컬럼 간 **자동 이동**시킨다.
핵심 사용 맥락은 **라이브 시연**(대학 동기·교수 대상)이므로, 자동화가
화면에서 눈에 보이는 것 — PR을 머지하는 순간 카드가 실시간으로 완료 컬럼으로
이동하고, 토스트와 활동 피드가 그 사실을 설명해 주는 것 — 이 가장 큰 가치다.

### 이미 구현된 것 (변경 안 함)
- `POST /api/webhooks/github` 라우트: X-Hub-Signature-256 검증, `boards.github_repo`로
  보드 식별, `github_events` 적재, push/PR 본문의 `#CARD-xxx` → `cards.github_url` 연결.
- `verifySignature`, `extractCardIds` 유틸 + 단위 테스트.
- `useBoardRealtime`: `cards`/`columns` postgres_changes 구독 → 디바운스 `router.refresh()`.

### 이번에 추가하는 것 (빈 부분)
PR 상태 → 컬럼 간 **카드 이동** 로직. 현재 핸들러는 `github_url`만 붙이고
`column_id`는 건드리지 않는다.

### v1 범위
카드 자동 이동 + 실시간 반영 + PR 상태 배지 + 자동화 토스트/활동 피드.
**비범위(v1 제외):** GitHub issue → 카드 자동 생성, draft/ready 구분,
PR 닫힘(미머지) → 되돌림.

## 2. 결정 사항 (브레인스토밍 합의)

| 결정 | 선택 | 비고 |
|---|---|---|
| 목표 컬럼 결정 | **보드별 설정 매핑** | 컬럼 이름이 커스터마이즈 가능하므로 `column_id` 저장 |
| PR↔카드 식별 | **`cards.github_url` == `pull_request.html_url`** | 카드 상세에 PR URL 입력칸 추가 |
| 지원 전이 | **opened/reopened → 진행, merged → 완료** | 매핑 2개 |
| 토스트 소스 | **`board_activity` 신규 테이블** | 사람이 읽는 로그 + 활동 피드 |

## 3. 데이터 흐름

```
GitHub PR 이벤트
  → POST /api/webhooks/github  (기존: 검증·보드식별·github_events 적재)
  → [신규] PR 자동화 분기:
       1. payload.pull_request.html_url 로 카드 조회 (cards.github_url 일치, 해당 board 한정)
       2. 전이 판정: action in (opened, reopened) → 'open'
                     action == closed && pull_request.merged == true → 'done'
                     그 외 → null (이동 안 함, github_pr_state 만 갱신)
       3. boards 매핑에서 목표 column_id (pr_open_column_id / pr_merged_column_id)
       4. admin 으로 cards 업데이트: column_id, position(타깃 끝), github_pr_state
       5. board_activity insert (card_id, message)
  → Supabase Postgres CDC
       · cards 변경 → useBoardRealtime 재동기화 → 카드가 화면에서 이동
       · board_activity insert → [신규] 구독 → sonner 토스트 + 활동 피드 갱신
```

## 4. 스키마 변경

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
  kind text not null,                 -- 예: 'pr_automation'
  message text not null,              -- 사람이 읽는 한 줄
  created_at timestamptz not null default now()
);
create index on public.board_activity(board_id, created_at desc);

-- RLS: board_activity SELECT 는 워크스페이스 멤버. INSERT 는 service_role(웹훅)만.
alter table public.board_activity enable row level security;
-- SELECT 정책: 해당 board 의 워크스페이스 멤버 (기존 is_workspace_member 헬퍼 재사용)
-- INSERT 정책: 없음 → service_role 키만 삽입 가능(RLS 우회).
```

`board_activity`를 별도로 두는 이유: `github_events`는 원시 payload·card_id 없음.
사람이 읽는 줄과 card_id를 가진 전용 테이블이 토스트·피드·시연 스토리를 깔끔히 해결.

`cards`/`columns`/`board_activity`가 Supabase realtime publication에 포함돼야 한다
(`cards`·`columns`는 기존 포함 추정 — 적용 시 확인, `board_activity`는 추가 필요).

## 5. 코어 로직 (순수 함수로 분리 — 테스트 가능)

`src/features/pr-automation/model/` (FSD feature 신설):

```ts
// 전이 판정 (순수)
type PrTransition = 'open' | 'done' | null;
function resolvePrTransition(action: string, merged: boolean): PrTransition;
//  opened|reopened → 'open'
//  closed && merged → 'done'
//  그 외 → null

// 목표 컬럼 선택 (순수)
function pickTargetColumn(
  board: { pr_automation_enabled: boolean;
           pr_open_column_id: string | null;
           pr_merged_column_id: string | null },
  transition: PrTransition,
): string | null;   // 비활성/매핑없음/삭제(null) → null (skip)

// PR 상태 문자열 (배지용, 순수)
function prBadgeState(action: string, merged: boolean): 'open'|'merged'|'closed';
```

라우트는 이 순수 함수들을 호출하고, DB I/O(카드 조회/업데이트, activity insert)만 담당.

## 6. 이동 의미 / 멱등성 / 안전

- **position:** 타깃 컬럼 마지막 카드 뒤. 기존 `lexorank.between(lastPos, null)` 재사용.
- **멱등:** 카드가 이미 타깃 컬럼이면 column_id 변경 skip(단, `github_pr_state`는 갱신).
  `github_events.processed_at` 기록 유지. GitHub 재전송 안전.
- **매핑 없음/비활성:** 조용히 skip. activity 로그 남기지 않음(소음 방지).
- **매칭 카드 0개:** skip(서버 로그만).
- **다중 매칭:** 전부 이동(보통 1개).
- **권한/격리:** 웹훅은 service_role(RLS 우회) — 의도됨. 보드는 `github_repo`로 한정돼
  교차 보드 오염 없음. 매핑 컬럼 FK는 `on delete set null`로 컬럼 삭제 시 자동 무력화.

## 7. UI 표면

### (a) 보드 설정 — PR 자동화 매핑
- 위치: **보드별 surface**(보드 컨텍스트 패널 내 설정 affordance 또는 보드 설정 모달).
  매핑이 해당 보드의 column_id를 참조하므로 전역 설정 화면이 아닌 보드 스코프에 둔다.
  owner·admin만 편집(`getMyBoardRole`).
- 토글(`pr_automation_enabled`) + 드롭다운 2개: "PR 열림 → [컬럼]", "PR 머지 → [컬럼]".
  컬럼 목록은 해당 보드 컬럼.
- **첫 연동 자동 추천값:** 이름 휴리스틱(진행/progress→open, 완료/done→merged)으로
  드롭다운 기본 선택(편집 가능). 설정 0번에도 시연 즉시 가능.

### (b) 카드 PR 상태 배지
- `github_pr_state`: open=노랑 "PR 열림", merged=보라 "PR 머지", closed=회색.
  보드 카드칩 + 카드 상세에서 기존 AI 배지 옆에 표시.
- 카드 상세에 **PR URL 입력칸** 추가. `updateCard` 액션이 이미 `github_url`(zod url) 수신 →
  입력 컴포넌트만 추가.

### (c) 자동화 토스트 + 활동 피드
- `board_activity` insert를 postgres_changes로 구독 → `sonner` 토스트
  "🤖 PR #42 머지 → 'API 연동'을 완료로 이동".
- 보드 컨텍스트 패널(`board-context-panel`)에 최근 활동 N줄 피드.

## 8. 테스트

**단위(vitest, 기존 패턴):**
- `resolvePrTransition(action, merged)` — opened/reopened/closed+merged/closed+unmerged/기타.
- `pickTargetColumn(board, transition)` — 활성·비활성·매핑 null·정상.
- 이동 position 계산(빈 컬럼/끝에 붙이기).
- github_url 매칭(정확 일치 / 미링크 skip).
- `prBadgeState` 매핑.

**라이브 검증(데모 보드):**
- 카드에 PR URL 링크 → opened 웹훅 모의 POST(유효 시그니처) → 카드가 진행 컬럼으로 이동 + 노랑 배지 + 토스트.
- merged 웹훅 → 완료 컬럼 이동 + 보라 배지 + 토스트.
- 재전송(동일 payload) → 카드 위치 불변(멱등).
- 미링크 카드 → 변화 없음.

## 9. 파일 영향 (예상)

```
신규:
  supabase/migrations/000X_pr_automation.sql        # 스키마 4장
  src/features/pr-automation/model/transition.ts    # 순수 함수 5장
  src/features/pr-automation/model/transition.test.ts (tests/unit/ 하위 배치 가능)
  src/features/pr-automation/ui/pr-automation-settings.tsx  # 매핑 UI 7(a)
  src/features/pr-automation/ui/pr-status-badge.tsx        # 배지 7(b)
  src/features/pr-automation/ui/card-github-url-input.tsx  # PR URL 입력 7(b)
  src/features/pr-automation/model/use-board-activity.ts   # 활동 구독·토스트 7(c)
  src/entities/board/api/activity.ts                # board_activity 조회/타입

변경:
  src/app/api/webhooks/github/route.ts              # PR 자동화 분기 추가(3장)
  src/shared/types/database.ts                      # boards/cards 신규 컬럼 + board_activity 타입
  src/widgets/card-detail-panel/ui/card-detail.tsx  # 배지 + PR URL 입력
  src/widgets/board-view/ui/board-card.tsx          # 카드칩 배지
  src/widgets/board-view/ui/board-context-panel.tsx # 활동 피드
  src/app/(main)/settings/page.tsx (또는 보드 설정)  # 매핑 UI 연결
  src/entities/board/api/queries.ts                 # 매핑/배지 필드 select 포함
```

## 10. 미해결/적용 시 확인
- Supabase realtime publication에 `board_activity` 추가 필요(적용 시).
- 보드별 매핑 UI의 정확한 host(컨텍스트 패널 설정 affordance vs 모달)는 구현 계획에서 확정.
- PR 번호 추출(`pull_request.number`)을 토스트 메시지에 포함.
