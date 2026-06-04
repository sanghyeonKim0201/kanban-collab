---
title: 동시성·멱등 안전한 Supabase 웹훅 자동화 (멱등키 + unique·재시도 + RPC conflict 신호)
date: 2026-06-04
category: design-patterns
module: pr-automation
problem_type: design_pattern
component: database
severity: medium
related_components: ["github-webhook", "lexorank", "board-activity"]
applies_when:
  - "GitHub(또는 at-least-once) 웹훅이 카드/레코드를 이동·변경하고, 재전송 시 중복 부작용이 생길 수 있을 때"
  - "여러 웹훅이 같은 컬럼/리스트 끝에 동시에 append 해서 같은 정렬 position 을 계산할 수 있을 때"
  - "Supabase/PostgREST 의 service_role 클라이언트에서 unique 위반을 감지해 재시도하려는데, 위반이 plpgsql 함수 내부에서 발생할 때"
tags: [webhook, idempotency, concurrency, supabase, postgrest, lexorank, rpc, optimistic-retry]
---

# 동시성·멱등 안전한 Supabase 웹훅 자동화

## Context

kanban-collab 의 GitHub PR 자동화 웹훅(`src/app/api/webhooks/github/route.ts`)에 대한
적대적 리뷰에서 Critical 0건, Important 2건이 나왔다. 데모 v1 에선 트리거 조건이
통제된 시연에서 안 나타나 수용했고, 이 문서는 후속 견고화에서 확립한 설계 패턴이다.

1. **멱등 부재** — GitHub 가 동일 웹훅을 재전송(timeout/5xx 자동 retry, UI Redeliver)하면
   활동 로그가 중복되고, 사용자가 수동으로 옮긴 카드를 자동화가 되돌린다.
2. **동시 append position 충돌** — 두 PR 웹훅이 거의 동시에 같은 타깃 컬럼 끝에 append 하면
   동일 `lastPos` 를 읽어 같은 `position`(lexorank)을 계산 → 두 카드 동일 position →
   이후 그 사이로 드롭하면 `between(a,b)` 가 `a>=b` 에서 throw → 드래그가 깨진다.

## Guidance

세 가지 패턴을 함께 적용한다.

### 1) 웹훅 delivery 멱등 키

`X-GitHub-Delivery`(GUID)는 **자동 retry·수동 Redeliver 모두에서 동일하게 유지**된다
(GitHub 공식 권장 idempotency key). 이를 unique 컬럼에 저장하고 진입부에서 기처리면
early-return 한다. 헤더 부재 시 `null` 은 partial unique index(`where delivery_id is not null`)로
다중 허용 → degrade-safe.

```sql
alter table public.github_events add column delivery_id text;
create unique index github_events_delivery_id_key
  on public.github_events (delivery_id) where delivery_id is not null;
```

```ts
const delivery = request.headers.get("x-github-delivery");
if (delivery) {
  const { data: dup } = await admin
    .from("github_events").select("id").eq("delivery_id", delivery).maybeSingle();
  if (dup) return NextResponse.json({ ok: true, skipped: "duplicate delivery" });
}
// insert 시 unique 위반(23505)도 동시 경합 백스톱으로 동일 처리.
```

SELECT 는 흔한(비동시) 재전송용 빠른 경로, insert unique 위반은 동시 경합 백스톱. **둘 다.**

### 2) 동시 append: unique 제약 + 낙관적 재시도 (정렬 로직은 JS 단일 소스 유지)

DB 에 lexorank 를 포팅하지 말고(이중 소스·검증 불가), `unique(column_id, position)` 으로
충돌을 감지하고 애플리케이션에서 재시도한다. 재시도는 **항상 진전**한다: `between(last, null)`
은 컬럼 최대값보다 strictly 크므로 모든 기존 position 보다 크고, 충돌은 오직 동시 append
끼리만 발생한다. 충돌한 쪽이 커밋되면 `last` 가 갱신되어 재계산값이 또 strictly 커진다.

```ts
export async function appendWithRetry(
  readLastPosition: () => Promise<string | null>,
  applyAt: (position: string) => Promise<{ conflict: boolean }>,
  maxAttempts = 5,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const position = between(await readLastPosition(), null);
    const { conflict } = await applyAt(position);
    if (!conflict) return position;
    if (attempt >= maxAttempts) throw new Error("append 충돌 재시도 한도 초과");
  }
}
```

`applyAt` 을 주입 가능한 경계로 두면 인메모리 픽스처로 **동시성 회귀 단위테스트**가 가능하다
(같은 stale `last` 를 읽은 두 mover 가 서로 다른·정렬된 position 을 얻는지).

### 3) ★ 핵심: RPC 가 unique 위반을 **직접 잡아 conflict 문자열을 반환** (SQLSTATE 표면화 비의존)

`cards.update + board_activity.insert` 를 한 plpgsql 트랜잭션으로 묶어 부분 실패를 없애되,
**unique 위반을 함수 밖으로 전파시키지 말고 함수 안에서 잡아 `'conflict'` 를 반환**한다.
PostgREST/supabase-js 가 *함수 내부* 예외의 SQLSTATE(`23505`)를 `error.code` 로 어떻게
매핑하는지는 보장이 약하다 — 호출부가 `error.code === "23505"` 에 의존하면 재시도 전체가
그 매핑 하나에 걸린다. 결과 문자열로 신호하면 그 의존이 사라진다.

```sql
create or replace function public.apply_pr_card_move(...)
returns text language plpgsql set search_path = public as $$
begin
  if p_target_column_id is not null then
    begin
      update public.cards set github_pr_state = p_pr_state,
        column_id = p_target_column_id, position = p_position
        where id = p_card_id;
      if not found then return 'ok'; end if;            -- 동시 삭제 → 활동로그 skip(FK 위반 방지)
      if p_activity_message is not null then
        insert into public.board_activity(...) values (...);
      end if;
    exception when unique_violation then
      return 'conflict';                                -- ← 롤백 후 명시적 신호
    end;
    return 'ok';
  else
    update public.cards set github_pr_state = p_pr_state where id = p_card_id;
    return 'ok';
  end if;
end; $$;

revoke all on function public.apply_pr_card_move(...) from public, anon, authenticated;
grant execute on function public.apply_pr_card_move(...) to service_role;
```

```ts
async (position) => {
  const { data, error } = await admin.rpc("apply_pr_card_move", { ... });
  if (error) throw new Error(error.message);
  return { conflict: data === "conflict" };  // SQLSTATE 표면화에 의존 안 함
}
```

## Why This Matters

- **직접 테이블 insert 의 unique 위반은** PostgREST 가 `error.code === "23505"` 로 신뢰성 있게
  표면화한다(멱등키 백스톱에서 그대로 사용 OK). 하지만 **plpgsql 함수 내부에서 발생한** 위반은
  그 보장이 약하다. 재시도 같은 제어 흐름이 거기에 걸리면, 매핑이 어긋나는 순간 `else throw`
  가지로 빠져 재시도가 사라지고 — 원래 버그가 **그대로**(혹은 silent dup 대신 throw 로) 남는다.
  함수가 `'conflict'` 를 반환하면 성공/충돌을 데이터로 구분 → 어떤 드라이버에서도 안정적.
- **정렬 로직(lexorank)을 DB 로 포팅하면** 두 번째 진실 소스가 생기고 vitest 로 검증할 수 없다.
  JS 에 단일 소스로 두고 DB 는 unique 제약으로 "충돌 감지"만 맡기면, 재시도 로직이 순수
  함수로 단위테스트 가능해진다.
- **unique(column_id, position) 은 전역 불변식**이라 `createCard`/`moveCard`(드래그)에도 적용된다.
  드래그는 기존 낙관적 롤백+토스트로 graceful degradation 하지만, `createCard` 동시 생성은 현재
  재시도 없이 throw 한다 — blast radius 를 인지하고 후속으로 같은 append 재시도 적용을 검토.

## When to Apply

- at-least-once 웹훅이 부작용(이동/상태/로그)을 일으키고 재전송 중복이 문제 될 때 → 멱등키.
- 동시 요청이 같은 정렬 끝값을 계산할 수 있을 때 → unique 제약 + `appendWithRetry`.
- Supabase/PostgREST 에서 제약 위반을 감지해 분기하려는데 위반이 RPC(plpgsql) 내부일 때
  → 함수가 상태 문자열을 반환(에러 code 비의존).

## Examples

회귀의 본질(중복 position → 드래그 깨짐):

```ts
// 동시 append 가 같은 position 을 만들면:
between("U", "U"); // throw: "'a' (U) must be < 'b' (U)" → 그 사이 드롭 불가
// appendWithRetry 적용 후: posA="U", posB="z"(또는 "zU") → between(posA, posB) OK
```

## Related
- `docs/superpowers/specs/2026-06-02-github-pr-automation-design.md` 섹션 11(알려진 한계) — 본 패턴이 해결한 항목.
- 구현: `src/features/pr-automation/model/append-position.ts`, `supabase/migrations/0004_pr_automation_hardening.sql`, `tests/unit/pr-automation-append.test.ts`.
