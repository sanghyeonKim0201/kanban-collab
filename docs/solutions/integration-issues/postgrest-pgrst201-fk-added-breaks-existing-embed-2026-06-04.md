---
title: 새 FK 추가가 기존 PostgREST 임베드를 PGRST201 로 깨뜨림 (관계 모호성)
date: 2026-06-04
category: integration-issues
module: supabase-postgrest
problem_type: integration_issue
component: service_object
symptoms:
  - "카드 상세 페이지(/board/[boardId]/card/[cardId])가 항상 404 — getCardDetail 이 null 반환"
  - "Supabase 쿼리 에러 PGRST201: 'Could not embed because more than one relationship was found for columns and boards'"
  - "에러 hint 가 boards!boards_pr_open_column_id_fkey / boards!columns_board_id_fkey 등 여러 FK 중 택일을 요구"
root_cause: logic_error
resolution_type: code_fix
related_components:
  - database
  - integration
tags:
  - supabase
  - postgrest
  - embed-ambiguity
  - foreign-key
  - schema-migration
  - regression
---

# 새 FK 추가가 기존 PostgREST 임베드를 PGRST201 로 깨뜨림 (관계 모호성)

## Problem

한 마이그레이션이 `boards` 테이블에 `columns` 를 역참조하는 새 FK 컬럼(`pr_open_column_id`, `pr_merged_column_id`)을 추가하자, **다른 기능**(카드 상세)의 기존 PostgREST 임베드 `columns(...boards(...))` 가 관계 모호성(PGRST201)으로 에러를 던져 카드 상세가 전부 404 되는 회귀가 발생했다.

## Symptoms

- 카드 상세 라우트가 직접 진입·새로고침·클릭 모두 404. `getCardDetail()` 의 `if (!card) return null` 이 트리거.
- supabase-js 가 반환한 에러: `PGRST201 — Could not embed because more than one relationship was found for 'columns' and 'boards'`.
- 에러 hint: `Try changing 'boards' to one of: 'boards!boards_pr_merged_column_id_fkey', 'boards!boards_pr_open_column_id_fkey', 'boards!columns_board_id_fkey'`.

## What Didn't Work

- **RLS 의심:** 테스트 유저 RLS 컨텍스트에서 card/column/board 행이 전부 보였음(`card_visible:1`) — RLS 는 원인이 아니었다.
- **병렬 라우트(@modal) 함정 의심:** `@modal/default.tsx` 가 이미 존재해 하드 내비게이션 슬롯 문제도 아니었다.
- **dev 서버/.next 캐시 의심:** 깨끗한 새 서버에서도 재현 → 환경 아티팩트 아님.
- 결정타는 `getCardDetail` 의 supabase 응답 `error` 를 임시 로깅한 것 — PGRST201 이 그제서야 드러났다(supabase-js 는 `.maybeSingle()` 에서 error 를 던지지 않고 `{ data: null, error }` 로 반환하므로, error 를 구조분해하지 않으면 조용히 null 이 된다).

## Solution

임베드에서 FK 를 **명시**해 의도한 관계로 고정한다.

Before (모호 — `boards` 로 가는 관계가 3개):

```ts
.select("*, columns(board_id, boards(id, workspace_id)), card_assignees(...)")
```

After (FK 명시):

```ts
.select(
  "*, columns(board_id, boards!columns_board_id_fkey(id, workspace_id)), card_assignees(...)",
)
```

(파일: `src/entities/card/api/detail.ts`)

## Why This Works

PostgREST 는 임베드 대상 테이블로 가는 FK 가 **하나일 때만** 자동 추론한다. `boards` 가 `pr_open_column_id`/`pr_merged_column_id` 로 `columns` 를 역참조하기 시작하면서 `columns`↔`boards` 관계가 3개(정방향 `columns.board_id` + 역방향 2개)가 됐고, 추론이 불가능해져 PGRST201 을 던졌다. `boards!columns_board_id_fkey` 로 제약명을 명시하면 추론을 건너뛰고 원래 의도한 정방향 관계를 쓴다.

## Prevention

- **테이블에 FK 컬럼을 추가할 때는, 그 두 테이블을 임베드하는 기존 PostgREST 쿼리를 전부 점검한다.** 같은 두 테이블을 잇는 관계가 1→다수가 되면 명시 안 한 임베드가 전부 깨진다. `grep` 으로 `<tableA>(...<tableB>` / `<tableB>(...<tableA>` 패턴을 찾아라.
- **임베드는 처음부터 FK 를 명시하는 습관을 들인다**(`boards!fk_name(...)`). 미래의 스키마 변경에 견고하다.
- **supabase-js 쿼리는 `error` 를 항상 구조분해·검사한다.** `.maybeSingle()` 류는 throw 하지 않고 `{ data: null, error }` 를 주므로, error 를 무시하면 RLS·관계 에러가 "행 없음" 으로 위장돼 디버깅이 길어진다.
- 회귀 방지 테스트: 카드 상세 로드 happy-path 통합/e2e 테스트가 있었다면 마이그레이션 직후 빨간불로 잡혔을 것. 스키마를 건드리는 PR 은 영향 표면이 넓다.

## Related Issues

- 같은 마이그레이션(`0003_pr_automation.sql`)이 도입한 기능 문서: `docs/superpowers/specs/2026-06-02-github-pr-automation-design.md`. 이 회귀는 PR 자동화 기능 자체와 무관하지만 그 스키마 변경의 부작용이었다.
