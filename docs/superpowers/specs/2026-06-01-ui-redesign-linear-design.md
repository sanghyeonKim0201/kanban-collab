# UI 리디자인 디자인 스펙 — 다크 Linear 풍 (레퍼런스 기반)

작성일: 2026-06-01
대상: Kanban Collab 비주얼 레이어 전면 재설계

## 1. 목표 & 제약

- **목표:** 현재의 "전형적 흑백 shadcn 스타터 룩"을 폐기하고, 사용자가 제시한 애널리틱스 대시보드 레퍼런스의 **배치·컴포넌트 패턴**을 가져와 **다크 Linear 풍**으로 재구성한다.
- **핵심 제약 — 로직 동일:** `entities/*`, `features/*/model`, `api`, 서버액션, 라우트 구조, dnd 로직, 실시간/presence 로직, FSD 경계는 **변경하지 않는다.** 데이터 쓰기·핵심 비즈니스 로직 0 변경.
- **허용된 데이터 변경:** 화면 표시용 **읽기 전용 집계 쿼리(read)** 추가만 허용 (예: 보드 진행률, 상태별 카드 수). 스키마·쓰기·마이그레이션 변경 없음.
- **테마:** 다크 전용 (`<html class="dark">` 고정). 라이트 토큰·테마 토글 제거.
- **악센트:** 인디고-바이올렛 `#5E6AD2` 계열.

## 2. 스코프 / 논-골

### 바꾼다
- `src/app/globals.css` — 디자인 토큰 전면 교체 (다크 단일)
- `tailwind.config.ts` — 토큰/섀도/폰트 확장
- `src/app/layout.tsx` — 폰트(Inter), `dark` 고정
- `src/shared/ui/*` — 전 컴포넌트 className 재작성 (Radix 동작은 유지)
- `src/widgets/*` — `app-shell`, `board-view`(컬럼/카드), `card-detail-panel`, `meeting-panel`, `presence-cursors` 마크업/레이아웃
- 전 화면 — `(auth)/login`, `(auth)/signup`, `workspaces`, `workspaces/[id]`, `board/[boardId]`, `meetings`, `meetings/[meetingId]`, `settings`
- `src/features/*/ui/*` — 폼/다이얼로그 마크업 (model 은 불변)

### 안 건드린다 (논-골)
- 모든 `*/api/*`, `*/model/*` (단, 신규 read 쿼리 파일 추가는 예외)
- 서버액션 시그니처/동작, 라우트 경로, DB 스키마/마이그레이션, RLS
- dnd-kit 의 이동 계산(LexoRank)·충돌 감지, 실시간 구독 로직
- 라우트 추가/삭제 (인터셉트 모달 구조 유지)

## 3. 디자인 토큰 (다크 단일)

`globals.css` 의 `:root` 를 다음으로 교체하고 `.dark` 분기는 삭제 (단일 테마):

```
--background:         240 6% 6%      /* #0E0E10 앱 베이스 */
--surface:            240 5% 9%      /* #16161A 카드/패널 한 단계 위 */
--surface-2:          240 5% 11%     /* #1B1B20 한 단계 더 위 (호버/팝오버) */
--popover:            240 5% 11%
--muted:              240 4% 14%
--muted-foreground:   240 5% 64%
--foreground:         240 10% 96%    /* 살짝 차분한 화이트 (순백 아님) */
--border:             240 5% 16%     /* 은은한 1px 경계 */
--border-strong:      240 5% 22%     /* 강조 경계 */
--primary:            231 56% 60%    /* #5E6AD2 인디고-바이올렛 */
--primary-foreground: 0 0% 100%
--ring:               231 56% 64%    /* 포커스 글로우 */
--destructive:        0 72% 55%
--success:            152 55% 48%
--warning:            38 92% 56%
--radius:             0.625rem        /* 10px 기본 라운드 */
```

- **우선순위 컬러:** low → `--muted-foreground`, medium → `--warning`, high → `--destructive`.
- **상태 pill 컬러:** 각 컬럼/상태에 톤다운된 tint (배경 = 컬러 12% alpha, 텍스트 = 컬러 밝은 톤).

### 다크 변환 원칙 (라이트 레퍼 → 다크)
레퍼런스의 "흰 카드 + 드롭섀도" 깊이감을 다크에서 재현하는 규칙:
1. 깊이는 **밝기 단계**(`background` → `surface` → `surface-2`)로 표현.
2. 카드 경계는 드롭섀도 대신 **1px `--border` + 아주 옅은 안쪽/바깥 섀도**.
3. hover 는 `surface-2` 로 한 톤 상승 + border 가 accent 로.
4. accent 는 면적 최소화 — 버튼/활성 인디케이터/링크/포커스/선택에만.

## 4. 타이포그래피

- **Inter** (`next/font/google`), `font-feature-settings: "cv11","ss01","tnum"`.
- 본문 13–14px, 헤딩 음수 트래킹 `-0.01em`.
- 스케일: 페이지 타이틀 18–20px / 섹션 15px·semibold / 카드 제목 13px / 메타·라벨 12px·muted / 마이크로 11px.
- 숫자(카운트·진행률)는 `tabular-nums`.

## 5. 정보구조 & 레이아웃 (2단 좌측 내비)

레퍼런스의 "아이콘 레일 + 보조 패널" 을 우리 라우트에 매핑:

```
┌──────┬─────────────────┬──────────────────────────────┐
│ 아이콘│ 보조 컨텍스트 패널 │ 메인 컨텐츠                    │
│ 레일  │ (~240px)         │ (상단 툴바 + 본문)             │
│(~56px)│                  │                              │
└──────┴─────────────────┴──────────────────────────────┘
```

- **아이콘 레일 (~56px):** 로고 / 워크스페이스(보드) / 회의록 / 설정 아이콘 / 하단 유저 아바타+메뉴. 활성 항목은 accent 좌측 인디케이터.
- **보조 컨텍스트 패널 (~240px, 접기 가능):** 현재 섹션에 따라 내용 전환.
  - 보드 컨텍스트: 워크스페이스 스위처(드롭다운, 기존 `/workspaces` 재사용) + 보드 목록 + **Overview 미니 스탯 카드**(실데이터: 보드 진행률, 상태별 카드 수) + **최근 활동**(기존 카드/코멘트 `updated_at` 기반).
  - 회의록 컨텍스트: 회의 목록.
- **메인 상단 툴바:** 페이지/보드 타이틀 + 뷰 토글(Board/List) + 필터·정렬 + presence 아바타 + 1차 액션 버튼.
- 본문은 전체 높이 활용.

`app-shell` 위젯이 레일 + 보조 패널 + 툴바 슬롯을 제공하고, 각 화면이 보조 패널/툴바 내용을 주입한다.

## 6. 화면별 설계

### 인증 (`login` / `signup`)
- 풀스크린 딥 다크, 중앙 카드에 미묘한 방사형 accent 글로우. 로고 + 폼 + OAuth 버튼(아이콘). `auth-form` 마크업만 교체.

### 워크스페이스 목록 (`/workspaces`)
- 카드 그리드. 각 카드: 워크스페이스명 + 역할 badge + (보드 수). hover lift. 빈 상태는 일러스트/아이콘 + CTA.

### 워크스페이스 상세 (`/workspaces/[id]`) — 보드 목록
- 레퍼런스의 "Projects 그리드/테이블" 매핑. **Grid/List 토글.**
  - Grid: 보드 카드(이름, **진행률 바**=마지막 컬럼 카드 비율, 멤버 아바타 스택, 카드 수).
  - List: 테이블 행(보드명, 진행률, 멤버, 최근 업데이트).

### 보드 (`/board/[boardId]`) — 칸반
- 툴바: 보드명 + **Board/List 뷰 토글** + 필터(우선순위·담당자·라벨) + presence + "카드 추가".
- **Board 뷰(기본):** 컬럼 = `--surface` 라운드 12px, 헤더(컬럼명 + 카운트 chip + `+`/메뉴). 드롭 타깃 시 accent 글로우. 카드 = `--surface-2` + 1px border, hover 시 translateY(-1px)+accent border, 좌측 우선순위 컬러 바, 라벨 미니 chip, 담당자 아바타 스택, AI 카테고리 accent-tint chip. 드래그 시 그림자+살짝 스케일, 드롭 자리 점선 플레이스홀더. (dnd 로직 불변, 스타일만)
- **List 뷰(신규, 표시 전용):** 기존 카드 데이터를 테이블 행으로 — 제목, 우선순위 pill, 상태(=컬럼), 라벨, 담당자. 읽기 전용 렌더, 쓰기 로직 없음.

### 카드 상세 (`@modal` 인터셉트)
- **우측 슬라이드오버 패널**(Linear 시그니처)로 렌더. 탭: **개요**(설명·우선순위·라벨·담당자·GitHub 링크) / **활동**(코멘트). 기존 인터셉트 라우트·데이터 그대로.
- 확정 필요: 슬라이드오버 vs 중앙 모달 (섹션 11).

### 회의록 (`/meetings`, `/meetings/[meetingId]`)
- 목록: 회의 카드/행(제목, 날짜, 상태 pill = 업로드/STT/추출완료).
- 상세: 탭 **트랜스크립트 / 추출된 작업 / 활동**. 업로드 존은 점선 드래그&드롭. "카드로 보내기" = accent 버튼. `meeting-panel`/`action-items`/`upload-form` 마크업 교체.

### 설정 (`/settings`)
- 좌측 섹션 리스트(일반 / 연동 / …) + 우측 컨텐츠. GitHub 연동 폼(`repo-form`) 카드화.

## 7. 데이터 (읽기 전용 집계) 추가

스탯/차트 치환을 위해 **read 함수만** 추가 (FSD: 해당 entity 의 `api/queries.ts` 또는 신규 `api/stats.ts`):

- `getBoardProgress(boardId)` → 마지막(완료) 컬럼 카드 / 전체 카드 비율
- `getStatusCounts(boardId)` → 컬럼별 카드 수
- `getRecentActivity(scope)` → 최근 변경 카드/코멘트 N개 (`updated_at` 정렬)
- `getCounts(workspaceId)` → 보드/카드/회의 수
- (스파크라인용) `getCompletionSeries(boardId)` → 일자별 완료 카드 수 (기존 `updated_at`/상태 기반 집계, 신규 컬럼 없음)

모두 순수 SELECT 집계. 쓰기·트리거·스키마 변경 없음.

## 8. 차트 접근 — 무의존 SVG 스파크라인

- 차트 라이브러리 **추가 안 함**(recharts 등 과중). `shared/ui/sparkline.tsx` 에 경량 SVG 영역/라인 스파크라인 컴포넌트 자작.
- props: `data: number[]`, `variant: "area" | "line"`, accent 컬러 사용. Overview 미니 스탯·회의 추세 등에 사용.

## 9. 컴포넌트 인벤토리

### 재스타일 (기존 `shared/ui`, Radix 동작 유지)
button, card, badge, input, textarea, label, avatar, dialog, dropdown-menu

### 신규 (`shared/ui`)
- `sidebar` / `icon-rail` (또는 `app-shell` 내부 구성)
- `toolbar`
- `stat-card` (라벨 + 값 + 스파크라인)
- `sparkline`
- `status-pill` (컬러 tint 상태칩)
- `toggle` (Radix Switch 기반 — 의존성 추가 시 스펙 갱신, 아니면 자작)
- `tabs` (Radix Tabs — 의존성 추가 필요 시 스펙 갱신, 아니면 자작 경량)
- `empty-state` (아이콘/일러스트 + 문구 + CTA)
- `slide-over` (Radix Dialog 변형, 우측 패널)
- `progress-bar`
- `segmented-control` (Board/List, Grid/List 토글)

> 의존성 추가 후보: `@radix-ui/react-switch`, `@radix-ui/react-tabs`. 동작·접근성 안정성을 위해 추가 권장하나, "의존성 최소" 선호 시 자작 경량으로 대체 가능 — 섹션 11 확정.

## 10. 모션 / 인터랙션

- 전환 120–160ms ease. hover/active/focus 상태 일관, 포커스는 accent ring.
- 모달/드롭다운/슬라이드오버 fade+scale/slide (`tailwindcss-animate`).
- 드래그 카드: 그림자 + 1.02 스케일 + 살짝 기울기. 과한 애니메이션 지양 (Linear 의 "조용한 정교함").

## 11. 확정 필요 (스펙 리뷰에서 결정)

1. **카드 상세:** 우측 슬라이드오버(권장) vs 중앙 모달.
2. **Board List 뷰** 포함 여부 (표시 전용 신규 뷰).
3. **Tabs/Switch 의존성:** Radix 추가 vs 자작 경량.

기본값(권장): 슬라이드오버 / List 뷰 포함 / Radix Tabs·Switch 추가.

## 12. 구현 순서 (개략)

1. 토큰(`globals.css` + `tailwind.config.ts`) + 폰트(`layout.tsx`)
2. `shared/ui` 재스타일 + 신규 프리미티브
3. `app-shell` (아이콘 레일 + 보조 패널 + 툴바)
4. 보드(컬럼/카드 + Board/List 뷰 + 드래그 스타일)
5. 워크스페이스 목록·상세, 카드 상세 슬라이드오버
6. 회의록·설정·인증
7. 읽기 전용 집계 read + Overview 스탯/스파크라인 배선
8. dev 프리뷰 검수 (화면별 스크린샷), 다크 일관성·포커스·반응형 점검
