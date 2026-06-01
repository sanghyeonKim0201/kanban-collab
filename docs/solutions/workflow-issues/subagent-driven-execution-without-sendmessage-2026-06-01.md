---
title: SendMessage 없는 하니스에서 subagent-driven-development 실행하기
date: 2026-06-01
category: workflow-issues
module: dev-workflow
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "superpowers subagent-driven-development 로 멀티태스크 플랜을 이 하니스에서 실행할 때"
  - "Agent 로 띄운 general-purpose 서브에이전트가 작업/커밋을 끝낸 뒤 적대적 질문을 던지며 멈출 때"
  - "로직 불변 + 비주얼만 교체하는 대규모 UI 재디자인을 태스크 단위로 돌릴 때"
tags: [subagent-driven-development, orchestration, superpowers, git-verification, ui-redesign]
---

# SendMessage 없는 하니스에서 subagent-driven-development 실행하기

## Context

kanban-collab 의 UI를 다크 Linear 풍으로 전면 재디자인하는 작업(13 태스크)을 superpowers `subagent-driven-development` 로 실행했다. 이 워크플로는 "태스크별 implementer 디스패치 → 적대적 리뷰 → 다음" 을 전제로 하고, 막히면 컨트롤러가 서브에이전트에게 답을 주고 이어가도록 설계돼 있다. 그런데 이 하니스에는 **spawned 에이전트를 이어가는 `SendMessage` 도구가 없다**(이름 검색·ToolSearch 모두 실패). 동시에 `Agent` 로 띄운 general-purpose 서브에이전트는 "do not stall" 지침을 줘도 **작업과 커밋을 끝낸 직후 적대적 질문 하나를 던지며 턴을 끝내는** 경향이 강했다(grill 성향). 그 결과 매 태스크가 "구현은 됐는데 보고가 질문으로 끝남" 형태가 됐다.

## Guidance

1. **에이전트가 질문으로 끝나면, 답하려 하지 말고 git 상태부터 본다.**
   `git status --porcelain` + `git log --oneline -1` 로 커밋 여부를 확인한다. 이 환경의 에이전트는 대개 **커밋을 먼저 하고 질문은 마지막에** 던지므로, 워킹트리가 클린하고 새 커밋이 있으면 그 질문은 십중팔구 비이슈다 — 컨트롤러가 판단해 다음으로 넘어간다.

2. **커밋이 안 됐고 워킹트리에만 변경이 있으면**, 결정을 프롬프트에 박아 **finalizer 에이전트**(변경 검증 + 테스트 + 커밋만 수행)로 재디스패치하거나, 트리비얼하면 컨트롤러가 직접 검증·커밋한다. 같은 에이전트를 새로 디스패치해 처음부터 재작업시키지 않는다(작업이 이미 트리에 있다).

3. **리뷰어가 낸 트리비얼 Minor(a11y sr-only, focus ring, 중복 클래스, 1줄 스타일)는 컨트롤러가 직접 1줄 수정·커밋**하는 편이 서브에이전트 왕복보다 빠르고 싸다. 실질적 변경만 서브에이전트로.

4. **디스패치 프롬프트에는 결정을 미리 박는다.** 모호점을 남기면 에이전트가 거기서 멈춘다. "이미 정해진 결정(do not re-litigate)" 섹션 + "BASE/HEAD SHA 보고" 를 명시하되, 그래도 완전히는 못 막으니 git 상태 검증을 기본 루프로 둔다.

5. **저위험 구간은 리뷰를 배칭한다.** 격리된 프리미티브 생성이나 순수 restyle 여러 태스크는 묶어서 한 번의 리뷰 디스패치로 처리(diff 범위 `BASE..HEAD`)해 왕복을 줄인다. dnd/realtime/라우팅 보존이 걸린 통합 태스크는 개별 정밀 리뷰.

## Why This Matters

워크플로 스킬이 가정한 "막히면 답 주고 이어가기" 루프가 이 하니스에선 불가능하다. 이걸 모르면 매 태스크마다 (a) 질문에 답하려다 실패하거나, (b) 새 에이전트로 전체 재작업시켜 토큰·시간을 2~3배 쓴다. "커밋 후 질문" 패턴을 알고 **git 상태를 단일 진실 소스로 삼으면** 13 태스크를 끊김 없이 흘릴 수 있다.

부수 학습 — **로직 불변 비주얼 재디자인의 데이터 정직성**: 사용자가 보여준 레퍼런스(애널리틱스 대시보드)에는 우리 데이터 모델에 없는 위젯(매출/예산/전환차트)이 많았다. 이를 지어내지 않고 **읽기 전용 집계 헬퍼**(보드 진행률·상태별 카드 수)와 무의존 SVG 스파크라인으로 치환해, "로직·스키마 0 변경" 제약을 지키면서 레퍼런스의 *비주얼 언어*만 가져왔다. 레퍼런스를 픽셀 클론하지 말고, 가진 데이터에 그 비주얼 언어를 입히는 게 핵심.

## When to Apply

- superpowers `subagent-driven-development` / `executing-plans`, 또는 `ce-compound` 처럼 서브에이전트를 오케스트레이션하는 모든 실행에서.
- 특히 `Agent` 결과가 `agentId ...(use SendMessage to continue)` 로 끝나는데 SendMessage 가 도구 목록·ToolSearch 에 없을 때 — 이어가기를 포기하고 git 검증/재디스패치로 전환.

## Examples

질문으로 끝난 에이전트 보고를 받은 직후:

```bash
git status --porcelain        # 비어 있으면(클린) 이미 커밋됨
git log --oneline -1          # 기대한 태스크 커밋 메시지/SHA 확인
git show --stat --oneline <sha> | head   # 의도한 파일만 바뀌었는지
```

- 클린 + 올바른 커밋 → 질문 무시하고 리뷰 단계로.
- 변경만 있고 커밋 없음 → finalizer 재디스패치(검증+커밋) 또는 트리비얼 직접 마무리.

## Related

- 메모리: subagent-driven-stall-pattern, kanban-ui-redesign-dark-linear
- 스펙/플랜: `docs/superpowers/specs/2026-06-01-ui-redesign-linear-design.md`, `docs/superpowers/plans/2026-06-01-ui-redesign-linear.md`
