---
title: PR 자동화 배지가 비-라이프사이클 웹훅 이벤트에 merged→open 으로 회귀
date: 2026-06-04
category: integration-issues
module: pr-automation
problem_type: integration_issue
component: service_object
symptoms:
  - "이미 'merged'(또는 'closed')로 표시되던 카드 PR 배지가 사용자 조작 없이 'open'으로 되돌아감 — 머지된 PR에 force-push/라벨변경 등이 일어날 때"
  - "GitHub pull_request 의 ~10종 action 마다 링크된 모든 카드에 cards.update 가 발생(쓰기 증폭)"
  - "cards.github_pr_state 가 stale 값으로 회귀 — prBadgeState(action, merged) 가 closed 아닌 모든 action 에 'open' 반환"
root_cause: logic_error
resolution_type: code_fix
severity: high
related_components:
  - database
  - integration
  - webhook
tags:
  - github-webhook
  - pull-request
  - persisted-state
  - idempotency
  - event-gating
  - nextjs-app-router
  - supabase
---

# PR 자동화 배지가 비-라이프사이클 웹훅 이벤트에 merged→open 으로 회귀

## Problem

GitHub 웹훅 핸들러가 모든 `pull_request` 이벤트마다 카드의 지속 상태 필드 `cards.github_pr_state`(배지: open/merged/closed)를 무조건 갱신했다. 그 결과 머지 이후 도착한 비-라이프사이클 이벤트(`synchronize`, `labeled` 등)가 `merged` 배지를 `open` 으로 덮어쓰는 지속-상태 회귀가 발생했다.

## Symptoms

- `merged`(또는 `closed`)로 올바르게 표시되던 카드 PR 배지가 사용자 조작 없이 뒤늦게 `open` 으로 되돌아감 — 머지된 PR의 force-push, 라벨 변경, 기타 edit 이벤트가 트리거.
- 쓰기 증폭: GitHub `pull_request` 의 ~10종 action 전부에 대해 링크된 모든 카드에 `cards.update` 가 발생(실제 상태 변화가 없어도).
- 회귀에 **컬럼 이동은 동반되지 않음**(이동 경로는 이미 게이트됨) → 배지 필드만 조용히 드리프트해서 발견이 어려웠음.

## What Didn't Work

- **이동 가드(`card.column_id !== targetColId`)에만 의존:** 이 가드는 중복 *이동*만 막는다. 배지 쓰기는 이동 발생 여부와 무관하게 별도 경로로 실행되므로 `github_pr_state` 를 보호하지 못한다.
- **delivery 단위 멱등(`X-GitHub-Delivery` id dedup):** 별도 하드닝으로는 가치 있으나, *중복* delivery 만 막는다. 정당한 `synchronize`/`labeled` delivery 는 중복이 아니므로 dedup 을 통과해 여전히 배지를 덮어쓴다. 근본 원인을 못 고쳐 후속 과제로 분리.

## Solution

자동화 블록 전체를 **라이프사이클 action(opened/reopened/closed)** 으로 게이트해, 비-라이프사이클 이벤트는 no-op 이 되게 한다.

Before — 모든 이벤트마다 배지 설정:

```ts
// opened, edited, synchronize, labeled, ... — 모든 pull_request action 에서 실행
await cards.update({ github_pr_state: prBadgeState(action, merged) });

function prBadgeState(action: string, merged: boolean) {
  if (action === "closed" && merged) return "merged";
  if (action === "closed") return "closed";
  return "open"; // <-- closed 아닌 모든 action 이 배지를 덮어씀
}
```

After — 라이프사이클 전이에서만 블록 진입:

```ts
if (
  event === "pull_request" &&
  payload.pull_request &&
  (payload.action === "opened" ||
    payload.action === "reopened" ||
    payload.action === "closed")
) {
  // 전이 판정 → 목표 컬럼 선택 → 카드 이동 → 배지 설정 → 활동 로그
}
```

`prBadgeState` 자체는 그대로 둔다 — 이제 게이트된 블록 안에서만 호출되므로 `return "open"` 폴백은 `opened`/`reopened` 에서만 도달하며 이는 올바른 동작이다.
(파일: `src/app/api/webhooks/github/route.ts`)

## Why This Works

근본 원인은 **지속 표시 상태**를 **고빈도·다중 action 이벤트 스트림**에 결합한 것이다. GitHub `pull_request` 이벤트는 ~10종 action 으로 발화하지만, 카드 라이프사이클에 의미 있는 것은 `opened`/`reopened`/`closed` 셋뿐이다. 이 셋으로 게이트하면 나머지 action 은 진짜 no-op(배지 쓰기 없음, DB churn 없음, 회귀 없음)이 된다. 필터링 결정을 **앞단**(어떤 이벤트에 반응할지)으로 끌어올려, 하류의 값-비교 가드가 피해를 사후에 잡아주길 기대하는 구조를 제거했다.

## Prevention

웹훅/이벤트 스트림에서 상태 필드를 파생·지속할 때:

1. **상태-의미 있는 이벤트를 열거해 명시적으로 게이트한다.** `pull_request`/`push`/`issues` 같은 이벤트 패밀리 전체에 반응하지 말고, 의미 있는 action allow-list 를 핸들러가 가장 먼저 검사하게 한다.
2. **"표시 상태"와 "전이"를 분리하되 *둘 다* 게이트한다.** 배지 계산 함수와 이동 계산 함수를 나누는 것은 좋지만, 각 쓰기 경로에 자체 가드가 필요하다. 이동 경로 가드가 배지 경로를 보호하지 않는다.
3. **비-라이프사이클 action 이 no-op 임을 단위 테스트로 고정한다.**

```ts
// 회귀 가드: 비-라이프사이클 action 은 지속 상태를 건드리면 안 됨
it.each(["synchronize", "labeled", "edited", "assigned"])(
  "%s 는 카드 업데이트를 수행하지 않는다",
  (action) => {
    expect(shouldRunAutomation("pull_request", action)).toBe(false);
  },
);
```

4. **delivery-dedup 으로 로직 갭을 때우려 하지 말 것.** 멱등 키는 중복 delivery 방어용이지, 과도하게 넓은 트리거를 올바르게 만들지 못한다. 트리거 범위를 먼저 좁히고, dedup 은 방어심화(defense-in-depth)로 추가한다.

## Related Issues

- 설계 스펙: `docs/superpowers/specs/2026-06-02-github-pr-automation-design.md` — 섹션 6 및 "그 외 → github_pr_state 만 갱신" 의도가 이 버그를 낳았다. "알려진 한계"(섹션 11)에 이 배지-회귀 케이스가 라이프사이클 게이트로 해결됨을 반영 필요(refresh 후보).
- 구현 계획: `docs/superpowers/plans/2026-06-02-github-pr-automation.md` — `prBadgeState` 계약 및 테스트 커버리지가 이제 stale. 단위 테스트의 "synchronize/기타 → null" 케이스는 `resolvePrTransition`(이동)만 덮고 `prBadgeState`(배지)는 안 덮어 버그를 통과시켰다.
