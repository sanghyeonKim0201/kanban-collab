# 칸반 기반 협업 프로젝트 관리 도구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 명세서 v1.0(FR-01~27 / NFR-01~19)의 칸반 기반 실시간 협업 프로젝트 관리 도구를, 즉시 실행 가능한 기반(M1)부터 외부 연동(M2~M4)까지 단계적으로 구현한다.

**Architecture:** Next.js 14 App Router 단일 코드베이스(클라이언트+Server Action+Route Handler)에 Supabase(Postgres/Auth/Realtime/Storage/RLS)를 BaaS로 결합한다. Feature-Sliced Design 6레이어(app/processes/widgets/features/entities/shared)로 의존성 방향을 강제한다. 실시간은 Postgres CDC + Presence + Broadcast 3채널을 병용한다.

**Tech Stack:** Next.js 14 (App Router) · TypeScript strict · Tailwind CSS · shadcn/ui · Supabase JS v2 · dnd-kit · TanStack Query · Zustand · react-hook-form + zod · Vitest/Playwright · pnpm · Vercel

---

## 범위와 세션 분할

명세서는 7스프린트/5마일스톤의 다중 서브시스템이다. 본 계획은 전체를 문서화하되 실행을 마일스톤 단위로 분할한다:

- **M1 (이번 세션 실행 대상)** — 프로젝트 셋업·인증·워크스페이스·칸반 코어. 산출물: `pnpm dev`로 구동되는 칸반 앱(Supabase env + 마이그레이션 적용 시 완전 동작).
- **M2** — 실시간 협업(Realtime CDC/Presence/Broadcast, 커서 공유, 충돌 감지). 이번 세션에서 채널 골격/엔티티 구독 훅까지 배선.
- **M3** — GitHub Webhook 연동. 이번 세션에서 서명검증 + 라우트 + 이벤트 적재 스텁 배선.
- **M4** — AI 작업 분류 + 회의록 자동 작업 생성. 이번 세션에서 LLM/STT wrapper 인터페이스 + Route 스텁 배선.
- **M5** — 품질·배포(e2e, NFR 측정, Vercel). 문서화만, 실행은 후속.

외부 자격증명(Supabase 프로젝트, LLM/STT API 키, GitHub OAuth/Webhook 시크릿)은 미발급 상태이므로 M2~M4의 외부 호출 본체는 인터페이스/스텁으로 구현하고 `.env.example`과 README에 발급 절차를 명시한다.

## File Structure (FSD, 명세 4.2 준수)

```
kanban-collab/
  src/
    app/
      layout.tsx                          # 루트 레이아웃, Providers
      globals.css                         # Tailwind + 흑백 토큰
      (auth)/login/page.tsx               # 이메일/OAuth 로그인
      (auth)/signup/page.tsx              # 회원가입
      (auth)/auth/callback/route.ts       # Supabase OAuth code exchange
      (main)/layout.tsx                   # 인증 가드 + 셸
      (main)/workspaces/page.tsx          # 워크스페이스 목록/생성
      (main)/workspaces/[id]/page.tsx     # 워크스페이스 홈(보드 목록/멤버)
      (main)/board/[boardId]/page.tsx     # 칸반 보드(RSC 초기 로드)
      (main)/board/[boardId]/card/[cardId]/page.tsx  # 카드 상세(인터셉트 모달)
      (main)/meetings/page.tsx            # 회의록 목록(M4)
      (main)/meetings/[meetingId]/page.tsx# 회의록 상세(M4)
      (main)/settings/page.tsx            # GitHub 연동/프로필(M3)
      api/webhooks/github/route.ts        # GitHub Webhook 수신(M3)
      api/ai/classify/route.ts            # AI 분류(M4)
      api/meetings/transcribe/route.ts    # STT(M4)
      api/meetings/extract-tasks/route.ts # 작업 추출(M4)
    processes/
      realtime-collaboration/             # 보드 실시간 세션 조립(M2)
    widgets/
      board-view/                         # 보드 전체 UI 블록
      card-detail-panel/                  # 카드 상세 패널
      meeting-panel/                      # 회의록 패널(M4)
      presence-cursors/                   # 실시간 커서 레이어(M2)
    features/
      auth-sign-in/                       # 로그인/회원가입 폼
      card-create/                        # 카드 생성
      card-drag/                          # dnd + position 계산
      card-assign/                        # 담당자 지정
      ai-classify-card/                   # AI 추천 적용(M4)
      meeting-record/                     # 회의록 업로드(M4)
      meeting-to-cards/                   # action item→카드(M4)
      github-link-card/                   # GitHub 연결 UI(M3)
    entities/
      card/{model,api,ui}/                # 카드 도메인
      column/{model,api,ui}/
      board/{model,api,ui}/
      user/{model,api,ui}/
      meeting/{model,api,ui}/             # (M4)
      workspace/{model,api,ui}/
    shared/
      ui/                                 # shadcn 컴포넌트
      lib/                                # utils, hooks (cn, lexorank, useDebounce)
      api/                                # supabase client(browser/server/admin)
      config/                             # env, 상수
      types/                              # DB 타입, 공통 타입
  supabase/
    migrations/0001_init.sql              # ERD 전체 + 인덱스
    migrations/0002_rls.sql               # RLS 정책 전면
  tests/
    unit/                                 # vitest: lexorank, hmac, parsers
    e2e/                                  # playwright(M5)
  .env.example
  README.md
```

**의존성 규칙(명세 4.3):** 상위→하위만 import. 같은 레이어 슬라이스 간 직접 import 금지(상위에서 조합). shared는 어떤 레이어도 import 불가. ESLint `boundaries` 플러그인으로 강제.

---

## M1: 프로젝트 셋업 · 인증 · 워크스페이스 · 칸반 코어 (이번 세션 실행)

### Task 1: 프로젝트 스캐폴드 + 툴체인

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.cjs`, `.gitignore`, `.env.example`, `src/app/globals.css`, `src/app/layout.tsx`

- [ ] **Step 1: Next.js 수동 스캐폴드**
  `pnpm init` 후 의존성 설치:
  `next@14 react react-dom @supabase/supabase-js @supabase/ssr @tanstack/react-query zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers react-hook-form zod @hookform/resolvers clsx tailwind-merge lucide-react`
  devDeps: `typescript @types/react @types/node tailwindcss postcss autoprefixer eslint eslint-config-next eslint-plugin-boundaries vitest @vitejs/plugin-react`

- [ ] **Step 2: tsconfig strict + path alias** — `strict: true`, `paths: { "@/*": ["./src/*"] }`, `noUncheckedIndexedAccess: true`

- [ ] **Step 3: Tailwind + 흑백 토큰** — `globals.css`에 명세 흑백 디자인 토큰(CSS 변수 light/dark), shadcn 호환 토큰 정의

- [ ] **Step 4: ESLint FSD 경계 규칙** — `eslint-plugin-boundaries`로 app>processes>widgets>features>entities>shared 단방향 강제

- [ ] **Step 5: 루트 레이아웃 + Providers** — QueryClientProvider, Toaster, html lang="ko"

- [ ] **Step 6: 검증** — Run: `pnpm exec tsc --noEmit && pnpm build` Expected: 빌드 성공

- [ ] **Step 7: Commit** — `chore: scaffold next14 + ts + tailwind + fsd lint`

### Task 2: Supabase 클라이언트 + DB 스키마 + RLS

**Files:**
- Create: `src/shared/api/supabase/{client,server,admin}.ts`, `src/shared/config/env.ts`, `src/shared/types/database.ts`, `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_rls.sql`

- [ ] **Step 1: env 검증 모듈** — zod로 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_WEBHOOK_SECRET?`, `LLM_API_KEY?`, `STT_API_KEY?` 파싱. 누락 시 명확한 에러.

- [ ] **Step 2: `@supabase/ssr` 클라이언트 3종** — browser(client component), server(RSC/Action, cookie 연동), admin(service role, Route Handler 전용)

- [ ] **Step 3: 0001_init.sql** — 명세 5.1 ERD 전체 테이블: workspaces, workspace_members, boards, columns, cards, card_assignees, labels, card_labels, comments, meetings, meeting_action_items, github_events. 명세 5.2의 cards 정의 + `create index on public.cards(column_id, position)`. 모든 FK ON DELETE 정책 명시.

- [ ] **Step 4: 0002_rls.sql** — 전 테이블 `enable row level security`. 명세 5.3 cards SELECT 정책(workspace_members 조인) + INSERT/UPDATE/DELETE를 role(owner/admin/member) 기준 분리. 워크스페이스 멤버십 헬퍼 함수 `is_workspace_member(ws uuid)`.

- [ ] **Step 5: DB 타입 선언** — `database.ts`에 테이블 Row/Insert/Update 타입(수기, supabase gen 대체). entities에서 재사용.

- [ ] **Step 6: 검증** — `pnpm exec tsc --noEmit`; SQL은 `psql`/Supabase 적용 시점 검증(README에 절차).

- [ ] **Step 7: Commit** — `feat: supabase clients + full schema + rls migrations`

### Task 3: lexorank position 유틸 (TDD)

**Files:**
- Create: `src/shared/lib/lexorank.ts`, `tests/unit/lexorank.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { between, first, last } from "@/shared/lib/lexorank";
test("between two ranks yields a value strictly inside", () => {
  const a = first(); const b = last();
  const mid = between(a, b);
  expect(a < mid && mid < b).toBe(true);
});
test("repeated insertion between never collides", () => {
  let lo = first(), hi = last();
  for (let i = 0; i < 50; i++) { const m = between(lo, hi); expect(m > lo && m < hi).toBe(true); hi = m; }
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm exec vitest run tests/unit/lexorank.test.ts` Expected: FAIL (module not found)

- [ ] **Step 3: 최소 구현** — base-36 문자열 lexorank: `first()`, `last()`, `between(a,b)` (중간 문자열 생성, 자리수 확장 처리)

- [ ] **Step 4: 통과 확인** — Run: `pnpm exec vitest run tests/unit/lexorank.test.ts` Expected: PASS

- [ ] **Step 5: Commit** — `feat: lexorank position util`

### Task 4: 인증 (이메일 + Google/GitHub OAuth)

**Files:**
- Create: `src/features/auth-sign-in/{model,ui}/*`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/auth/callback/route.ts`, `src/app/(main)/layout.tsx`, `src/entities/user/api/current-user.ts`, `src/shared/ui/*`(button,input,card,label 등 shadcn)

- [ ] **Step 1: shadcn 기초 컴포넌트** — button, input, label, card, dialog, dropdown-menu, avatar, badge, textarea, sonner를 `shared/ui`에 추가(수동 복사, FSD 경로)

- [ ] **Step 2: 로그인/회원가입 폼** — react-hook-form + zod 스키마, Supabase `signInWithPassword`/`signUp`, Google·GitHub `signInWithOAuth`

- [ ] **Step 3: OAuth callback route** — `exchangeCodeForSession`, 워크스페이스로 redirect

- [ ] **Step 4: (main) 인증 가드** — server에서 `auth.getUser()` 없으면 `/login` redirect

- [ ] **Step 5: 검증** — `pnpm exec tsc --noEmit && pnpm build`; dev 구동 후 `/login` 렌더 확인(preview)

- [ ] **Step 6: Commit** — `feat: auth (email + google/github oauth) + auth guard`

### Task 5: 워크스페이스 (목록/생성/멤버)

**Files:**
- Create: `src/entities/workspace/{model,api,ui}/*`, `src/features/workspace-create/*`, `src/app/(main)/workspaces/page.tsx`, `src/app/(main)/workspaces/[id]/page.tsx`

- [ ] **Step 1: workspace entity** — Row 타입, `listMyWorkspaces()`(server), `WorkspaceCard` ui

- [ ] **Step 2: createWorkspace Server Action** — zod 검증, workspaces insert + 생성자를 owner로 workspace_members insert, `revalidatePath`

- [ ] **Step 3: workspaces 페이지** — RSC 목록 + 생성 다이얼로그(client feature)

- [ ] **Step 4: 워크스페이스 홈** — 보드 목록 + 멤버 목록(role 표시), 멤버 초대 placeholder

- [ ] **Step 5: 검증** — tsc + build; preview로 목록/생성 흐름 확인

- [ ] **Step 6: Commit** — `feat: workspaces list/create + members view`

### Task 6: 보드/컬럼/카드 엔티티 + Server Actions

**Files:**
- Create: `src/entities/{board,column,card}/{model,api,ui}/*`, `src/features/card-create/*`, `src/features/card-assign/*`, server actions in `entities/*/api/actions.ts`

- [ ] **Step 1: 엔티티 타입+조회** — board/column/card Row 타입, `getBoardWithColumnsAndCards(boardId)` server 쿼리(컬럼 position 정렬, 카드 position 정렬, assignees/labels 조인)

- [ ] **Step 2: 카드 Server Actions (명세 6.2)** — `createCard`(position=lexorank last), `updateCard(id,patch)`, `moveCard(id,columnId,position)`(트랜잭션, updated_at 충돌감지), `deleteCard`, `assignCard(cardId,userId)`, `addComment(cardId,content)`. 모든 액션 진입부 `auth.getUser()` 확인.

- [ ] **Step 3: moveCard 충돌 감지 테스트(TDD)** — `tests/unit/move-card.test.ts`: 동일 updated_at 기대 불일치 시 거부 로직(순수 함수 분리 `resolveMove`)

- [ ] **Step 4: 컬럼 CRUD Action** — createColumn/renameColumn/reorderColumn

- [ ] **Step 5: 검증** — tsc + build + vitest

- [ ] **Step 6: Commit** — `feat: board/column/card entities + crud server actions`

### Task 7: 칸반 보드 UI + dnd-kit 드래그앤드롭

**Files:**
- Create: `src/widgets/board-view/*`, `src/features/card-drag/*`, `src/app/(main)/board/[boardId]/page.tsx`

- [ ] **Step 1: 보드 페이지(RSC)** — 초기 데이터 server fetch → BoardView에 전달(명세 10.1 초기 페인트 단축)

- [ ] **Step 2: BoardView 클라이언트** — 컬럼 가로 스크롤, 컬럼별 카드 리스트, Zustand로 보드 로컬 상태

- [ ] **Step 3: dnd-kit 통합** — `DndContext`+`SortableContext`, 카드/컬럼 드래그, 드롭 시 lexorank로 새 position 계산 → `moveCard` 낙관적 업데이트 + 실패 시 롤백(명세 10.1)

- [ ] **Step 4: 카드 생성 인라인** — 컬럼 하단 "+ 카드" → createCard

- [ ] **Step 5: 키보드 접근성** — dnd-kit KeyboardSensor(명세 10.3)

- [ ] **Step 6: 검증** — dev 구동, preview로 드래그·생성 동작 + console 에러 확인

- [ ] **Step 7: Commit** — `feat: kanban board view + dnd-kit drag/drop with optimistic move`

### Task 8: 카드 상세 패널 (인터셉트 모달)

**Files:**
- Create: `src/widgets/card-detail-panel/*`, `src/app/(main)/board/[boardId]/card/[cardId]/page.tsx`, `src/entities/card/api/comments.ts`

- [ ] **Step 1: 카드 상세 라우트** — `card/[cardId]` 페이지, 닫으면 보드 복귀(명세 7.2-3)

- [ ] **Step 2: 패널 UI** — 제목/설명 인라인 편집(updateCard), 우선순위/마감일, 담당자(assignCard), 라벨, 댓글 목록+작성(addComment)

- [ ] **Step 3: AI 분류/ GitHub 링크 자리** — 추천 영역·GitHub 링크 영역 placeholder(M3/M4 연결점)

- [ ] **Step 4: 검증** — preview로 카드 클릭→상세→편집→닫기 흐름

- [ ] **Step 5: Commit** — `feat: card detail panel with edit/assign/comments`

### Task 9: M1 통합 검증 + README + .env.example

**Files:**
- Create: `README.md`; Modify: `.env.example`

- [ ] **Step 1: README** — 셋업 절차(Supabase 프로젝트 생성→마이그레이션 적용→OAuth 설정→env→`pnpm dev`), 명세 12장 체크리스트 포함, 아키텍처 요약

- [ ] **Step 2: .env.example** — 전 변수(Supabase, GitHub, LLM, STT) + 설명 주석

- [ ] **Step 3: 전체 검증** — `pnpm exec tsc --noEmit && pnpm build && pnpm exec vitest run && pnpm exec eslint .`

- [ ] **Step 4: Commit** — `docs: setup readme + env example; chore: m1 integration check`

---

## M2: 실시간 협업 (채널 골격 배선 — 이번 세션 / 본체 후속)

### Task 10: Realtime 엔티티 구독 훅 + Presence + Broadcast 골격

**Files:**
- Create: `src/entities/card/model/use-board-realtime.ts`, `src/processes/realtime-collaboration/*`, `src/widgets/presence-cursors/*`, `src/features/card-drag/model/broadcast-drag.ts`

- [ ] **Step 1: board CDC 구독 훅** — `board:{boardId}` 채널 postgres_changes(cards/columns INSERT/UPDATE/DELETE) → Zustand 보드 상태 머지(명세 6.3)
- [ ] **Step 2: Presence 채널** — `board:{boardId}:presence` join, { userId,name,color,cursor,viewingCardId } track/sync
- [ ] **Step 3: 커서 레이어 위젯** — 다른 사용자 커서 렌더(명세 7.2-2), 색상 할당
- [ ] **Step 4: Broadcast 임시 드래그/타이핑** — `board:{boardId}:broadcast` 송수신, DB 미저장(명세 3.3 중요 박스 준수)
- [ ] **Step 5: 충돌 감지 UI** — updated_at 불일치 시 낙관적 롤백 + 토스트(명세 10.2)
- [ ] **Step 6: 검증** — 멀티탭 수동 확인(Supabase Realtime 활성 필요), 미설정 시 graceful no-op
- [ ] **Step 7: Commit** — `feat: realtime cdc + presence cursors + broadcast scaffold`

## M3: GitHub Webhook (서명검증 + 라우트 스텁 배선 — 이번 세션 / 처리 분기 후속)

### Task 11: HMAC 서명 검증 (TDD) + Webhook Route + 이벤트 적재

**Files:**
- Create: `src/shared/lib/github-signature.ts`, `tests/unit/github-signature.test.ts`, `src/app/api/webhooks/github/route.ts`, `src/features/github-link-card/*`, `src/app/(main)/settings/page.tsx`

- [ ] **Step 1: 실패 테스트** — `verifySignature(payload, secret, header)`: 유효 sha256=... true, 변조 false, timing-safe
- [ ] **Step 2: 실패 확인** — `pnpm exec vitest run tests/unit/github-signature.test.ts`
- [ ] **Step 3: 구현** — Node `crypto` HMAC-SHA256, `crypto.timingSafeEqual`
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: Webhook Route** — X-Hub-Signature-256 검증 → board_id 식별(boards.github_repo) → github_events 적재 → X-GitHub-Event별 분기 스텁(push/pull_request/issues; 명세 8.1) → processed_at 기록
- [ ] **Step 6: GitHub 연동 설정 UI** — settings에서 boards.github_repo 저장, Webhook URL 안내
- [ ] **Step 7: Commit** — `feat: github webhook signature verify + route + event ingestion`

## M4: AI 분류 + 회의록 자동 작업 (인터페이스/스텁 — 이번 세션 / 실호출 후속)

### Task 12: LLM/STT wrapper + AI 분류 Route + 카드 추천 UI

**Files:**
- Create: `src/shared/api/llm/index.ts`, `src/shared/api/stt/index.ts`, `src/app/api/ai/classify/route.ts`, `src/features/ai-classify-card/*`, `tests/unit/ai-parse.test.ts`

- [ ] **Step 1: LLM wrapper 인터페이스** — `classifyTask({title,description}) -> {category,priority,confidence}`; provider 미설정 시 명확한 에러/스텁 응답. 비용 추적 로그 훅.
- [ ] **Step 2: 응답 파싱 TDD** — LLM JSON 응답 파서(코드펜스/잡텍스트 제거 후 zod 검증) 테스트
- [ ] **Step 3: /api/ai/classify Route** — cards 본문 입력 → 분류 → `cards.ai_category` 갱신(추천만, 자동적용 OFF 기본; 명세 8.2 설계결정)
- [ ] **Step 4: 카드 상세 추천 UI** — 추천 카테고리/우선순위 표시 + "적용/거부" 버튼, 자동적용 토글(기본 OFF)
- [ ] **Step 5: Commit** — `feat: llm wrapper + ai classify route + recommendation ui (suggest-only)`

### Task 13: 회의록 업로드 + STT + 작업 추출 → 카드

**Files:**
- Create: `src/entities/meeting/{model,api,ui}/*`, `src/widgets/meeting-panel/*`, `src/features/meeting-record/*`, `src/features/meeting-to-cards/*`, `src/app/(main)/meetings/**`, `src/app/api/meetings/transcribe/route.ts`, `src/app/api/meetings/extract-tasks/route.ts`

- [ ] **Step 1: 업로드 + Storage** — 음성(.mp3/.m4a/.wav)/텍스트 업로드 → Supabase Storage, meetings insert(status=pending)
- [ ] **Step 2: /transcribe Route** — STT wrapper 호출(스텁 가능) → meetings.transcript 갱신, 비동기 처리
- [ ] **Step 3: /extract-tasks Route** — transcript → LLM 요약 + action items → meetings.summary, meeting_action_items 저장
- [ ] **Step 4: 검토 UI + 카드 일괄 생성** — action item 확인 → 대상 보드/컬럼 선택 → 카드 생성 후 meeting_action_items.card_id 연결, 양방향 링크 표시
- [ ] **Step 5: Commit** — `feat: meeting upload + stt + task extraction + cards linkage`

## M5: 품질 · 배포 (문서화, 실행 후속)

### Task 14: e2e + NFR 측정 + Vercel 배포 (후속 세션)

- [ ] Playwright 핵심 시나리오 5개(로그인→보드→카드 CRUD→드래그→실시간)
- [ ] NFR 측정: 보드 로드 시간, 실시간 지연, Lighthouse, 접근성 점검
- [ ] Vercel 프로덕션 배포 + 도메인 + 모니터링
- [ ] 운영 문서/사용자 가이드

---

## Self-Review

**1. Spec coverage:**
- 명세 2장 기술스택 → Task 1,2 (Next14/TS/Tailwind/shadcn/Supabase/dnd-kit/TanStack/Zustand/RHF+zod) ✔
- 명세 3장 아키텍처/데이터흐름/실시간 → Task 7(RSC 초기로드), Task 10(CDC/Presence/Broadcast 3채널, 커서 DB미저장) ✔
- 명세 4장 FSD → File Structure + Task 1 ESLint boundaries ✔
- 명세 5장 DB(ERD/테이블/RLS) → Task 2 ✔
- 명세 6장 API(Action/Route/Realtime/Webhook) → Task 6, 10, 11, 12, 13 ✔
- 명세 7장 화면/라우팅 → Task 4,5,7,8 + M4 페이지 ✔
- 명세 8장 외부연동(GitHub/AI/회의록) → Task 11,12,13 ✔
- 명세 9장 보안/권한(Auth, role 매트릭스, auth.uid()) → Task 2(RLS role 분리), Task 4, Task 6(액션 진입부 인증) ✔
- 명세 10장 NFR(성능/확장/가용/보안/무결성/유지보수/호환/사용성) → Task 1(strict/lint), 2(FK/RLS), 7(가상스크롤·낙관롤백), 10(충돌감지) ✔
- 명세 11장 WBS → M1~M5 매핑 ✔
- 명세 12장 체크리스트 → Task 9 README ✔

**2. Placeholder scan:** M2~M4 외부 호출 본체는 의도된 인터페이스/스텁(자격증명 미발급)으로 명시, "TODO/나중에" 류 모호 표현 없음. 각 Task 단계는 구체 파일·명령·기대결과 포함.

**3. Type consistency:** `moveCard(id,columnId,position)`/`createCard`/`assignCard`/`addComment` 명세 6.2와 일치, `between/first/last` lexorank API Task 3↔7 일치, `verifySignature` Task 11 내 일관.

**Gap 처리:** 멤버 초대 수락 흐름은 M1에서 placeholder(Task 5-4), 권한 매트릭스 enforcement는 RLS(Task 2) + 액션 가드(Task 6)로 분산 — 명세 9.2 표 전체는 M1 범위에서 RLS 정책으로 커버, UI 차원 비활성화는 후속 polish.
