# TaskFlow (kanban-collab)

칸반 기반 **실시간 협업 프로젝트 관리 도구**.
여러 명이 같은 보드를 동시에 편집하고, AI가 카드를 자동 분류하고, GitHub PR/이슈와 회의록이 카드로 이어진다.

**Next.js 14 (App Router) · Supabase · shadcn/UI · Feature-Sliced Design · TypeScript**

- 데모 계정: `admin@admin.com` / `admin`
- 시연 순서: 로그인 → 보드 → AI 추천 → 실시간 협업 → GitHub 연동 → AI 회의록 → 멤버 관리

---

## 주요 기능

| 분류 | 기능 | 요구사항 |
| --- | --- | --- |
| **칸반 코어** | 보드·컬럼·카드 CRUD, 드래그 앤 드롭 이동, 필터/검색, 레이블, 댓글, 활동 이력 | FR-01~09 |
| **실시간 협업** | 다중 사용자 동시 편집, 실시간 동기화, 접속자/커서 표시, 동시 수정 충돌 롤백 | FR-10~13 |
| **GitHub 연동** | 저장소 연결, PR 열림/머지 → 카드 자동 이동, 이슈 → 카드 생성, 커밋–카드 연결(`TF-123`) | FR-14~18 |
| **AI 자동화** | 카드 카테고리·우선순위·담당자 추천(few-shot 피드백 반영) | FR-19~22 |
| **AI 회의록** | 실시간 음성 받아쓰기·텍스트 회의록 → 요약·할 일 추출 → 카드로 변환 | FR-23~25 |
| **인증·권한** | 이메일/OAuth 로그인, 워크스페이스 멤버 초대, 역할별 권한(RLS) | FR-26~27 |

> 기능 요구사항 27개 중 25개 완전 구현, 2개 부분 구현(FR-02 컬럼 순서변경 UI, FR-26 OAuth 주소 등록). 상세는 [요구사항분석서](docs/submission/요구사항분석서.md)·[기능명세서](docs/submission/기능명세서.md) 참고.

---

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # 값 채우기 (아래 셋업 참고)
npm run dev                  # http://localhost:3000
```

Supabase 키가 없어도 dev 서버는 부팅되며 `/login` 은 렌더된다.
보드·워크스페이스 등 데이터 기능은 아래 셋업(Supabase + 마이그레이션)을 마쳐야 동작한다.

### 환경변수

`.env.local` 에 최소 다음이 필요하다 (`.env.example` 참고):

```bash
# 필수 — Supabase 대시보드 > Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 선택 — 미설정 시 해당 기능만 graceful 하게 비활성화
GITHUB_WEBHOOK_SECRET=     # GitHub 연동
LLM_PROVIDER=openai        # AI 분류·회의록 요약
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
STT_API_KEY=               # 음성 파일 받아쓰기 (실시간 받아쓰기는 브라우저 Web Speech API 사용, 키 불필요)
```

### 마이그레이션 적용

Supabase 대시보드 → SQL Editor 에서 `supabase/migrations/` 의 `0001` ~ `0008` 을 **번호 순서대로** 실행한다.
또는 Supabase CLI: `supabase db push`.

| 파일 | 내용 |
| --- | --- |
| `0001_init.sql` | 테이블·트리거 생성, Realtime 활성화 |
| `0002_rls.sql` | RLS 정책 + 멤버십 헬퍼 함수(`SECURITY DEFINER`) |
| `0003_pr_automation.sql` | PR→컬럼 매핑 컬럼, PR 상태 배지, 활동 로그 테이블 |
| `0004_pr_automation_hardening.sql` | `(column_id, position)` UNIQUE — 동시 추가 충돌 감지 |
| `0005_comment_label_mutations.sql` | 댓글·레이블 RLS(본인 댓글만 수정) |
| `0006_meeting_structured.sql` | 회의록 구조화 컬럼(`structured` jsonb) |
| `0007_board_activity_insert.sql` | 활동 이력 INSERT 정책 |
| `0008_member_management.sql` | 멤버 초대 RPC(`invite_member_by_email`) |

---

## 스크립트

```bash
npm run dev         # 개발 서버
npm run build       # 프로덕션 빌드
npm run typecheck   # tsc --noEmit
npm test            # vitest (테스트 17개 파일 전부 통과)
npm run lint        # next lint + FSD 경계 검사
```

테스트는 lexorank 정렬, 충돌 감지, AI 분류, PR 전이, GitHub 서명, 회의 요약, 카드 이동·필터, 멤버 권한 등
핵심 로직을 `tests/` 에서 검증한다.

---

## 아키텍처 (Feature-Sliced Design)

```
app > processes > widgets > features > entities > shared
```

상위 레이어만 하위를 import 하는 단방향 구조. `shared` 는 어떤 레이어도 import 하지 않는다.
ESLint `boundaries` 플러그인이 빌드 시 강제한다.

- **app** — App Router 라우트/레이아웃 (auth 그룹, main 그룹, api Route Handler)
- **processes** — realtime-collaboration 등 교차 프로세스
- **widgets** — board-view, card-detail-panel, app-shell, presence-cursors
- **features** — auth-sign-in, card-create, card-drag, board-filter, ai-classify-card, github-link-card, pr-automation, meeting-record, meeting-to-cards, member-manage …
- **entities** — board, column, card, label, workspace, user, meeting (model/api/ui)
- **shared** — ui(shadcn), lib(cn, lexorank, 서명검증), api(supabase·llm·stt), config(env), types

### 핵심 설계 결정

- **정렬(position)**: LexoRank 문자열 — 드래그 시 인접 두 항목만으로 O(1) 재배치
- **충돌 감지**: `moveCard` 가 `updated_at` 비교로 동시 편집을 감지, 불일치 시 낙관적 UI 롤백
- **실시간**: Supabase Postgres CDC 구독 + Zustand 스토어, 디바운스 resync
- **RLS**: 멤버십 헬퍼를 `SECURITY DEFINER` 함수로 만들어 정책 재귀 방지
- **읽기 = RSC/Server Action, 외부연동 = Route Handler** 로 분리
- **디자인 패턴**: Observer(실시간 알림)·Memento(드래그 롤백)·Strategy(AI 공급자 교체)·Repository(데이터 접근)

---

## 디렉터리

```
src/
  app/                 # 라우트 + api/{ai,meetings,webhooks}
  processes/           # realtime-collaboration
  widgets/             # board-view, card-detail-panel, app-shell …
  features/            # 14개 기능 슬라이스
  entities/            # board, column, card, label, workspace, user, meeting
  shared/              # ui, lib, api, config, types
supabase/migrations/   # 0001 ~ 0008
tests/                 # vitest 단위 테스트
docs/submission/       # 요구사항분석서 · 기능명세서
```
