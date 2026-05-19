# Kanban Collab

명세서 v1.0 — 칸반 기반 실시간 협업 프로젝트 관리 도구.
Next.js 14 (App Router) · Supabase · shadcn/UI · Feature-Sliced Design.

## 현재 구현 상태

| 마일스톤 | 범위 | 상태 |
| --- | --- | --- |
| **M1** | 셋업·인증·워크스페이스·칸반 코어 (보드/컬럼/카드 CRUD, dnd, 카드 상세) | ✅ 완료 |
| **M2** | 실시간 협업 (CDC/Presence/Broadcast, 커서, 충돌 롤백) | 🟡 골격 배선 |
| **M3** | GitHub Webhook (서명검증·라우트·이벤트 적재) | 🟡 골격 배선 |
| **M4** | AI 분류 + 회의록 자동 작업 (LLM/STT wrapper, Route) | 🟡 스텁 배선 |
| **M5** | 품질·배포 (e2e, NFR, Vercel) | ⬜ 후속 |

M2~M4 의 외부 호출 본체는 자격증명(GitHub/LLM/STT)이 발급되면 동작하도록
인터페이스·스텁으로 배선되어 있고, 키 미설정 시 graceful 하게 비활성화된다.

## 빠른 시작

```bash
pnpm install
cp .env.example .env.local   # 값 채우기 (아래 셋업 참고)
pnpm dev                     # http://localhost:3000
```

Supabase 미설정 시에도 dev 서버는 부팅되며 `/login` 은 렌더된다.
보드/워크스페이스 등 데이터 기능은 아래 셋업 완료 후 동작한다.

## 셋업 (명세 12장 체크리스트)

- [ ] **1. Supabase 프로젝트 생성 및 키 발급** — [supabase.com](https://supabase.com) 에서 프로젝트 생성 후 Project Settings → API 에서 URL / anon key / service_role key 확보
- [ ] **2. Next.js 리포지토리 초기화** — 완료 (App Router, TS strict)
- [ ] **3. shadcn/UI 설치 및 흑백 테마 토큰 정의** — 완료 (`src/shared/ui`, `globals.css`)
- [ ] **4. FSD 폴더 구조 생성 및 ESLint 규칙** — 완료 (`eslint-plugin-boundaries`)
- [ ] **5. ERD 기반 마이그레이션 작성** — 완료 (`supabase/migrations/0001_init.sql`)
- [ ] **6. RLS 정책 일괄 적용** — 완료 (`supabase/migrations/0002_rls.sql`). Supabase SQL Editor 에 `0001` → `0002` 순서로 붙여넣어 실행
- [ ] **7. 인증 흐름 구현** — 완료 (이메일 + Google/GitHub OAuth)
- [ ] **8. GitHub OAuth 앱 등록 및 Webhook 시크릿 발급** — Supabase Auth → Providers 에서 Google/GitHub 활성화, Redirect URL `${SITE_URL}/auth/callback` 등록. Webhook 은 M3
- [ ] **9. LLM/STT API 키 발급 및 사용량 모니터링** — M4 (`LLM_API_KEY`, `STT_API_KEY`)
- [ ] **10. Vercel 프로젝트 연결 및 Preview 배포 확인** — M5

### 마이그레이션 적용

Supabase 대시보드 → SQL Editor 에서:

1. `supabase/migrations/0001_init.sql` 전체 실행
2. `supabase/migrations/0002_rls.sql` 전체 실행

또는 Supabase CLI: `supabase db push`

### 환경변수

`.env.local` 에 최소 다음 3개가 필요하다 (`.env.example` 참고):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 스크립트

```bash
pnpm dev         # 개발 서버
pnpm build       # 프로덕션 빌드
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest (lexorank, 충돌감지)
pnpm lint        # next lint + FSD 경계 검사
```

## 아키텍처 (명세 4장 FSD)

```
app > processes > widgets > features > entities > shared
```

상위 레이어만 하위를 import (단방향). `shared` 는 어떤 레이어도 import 불가.
ESLint `boundaries` 플러그인이 빌드 시 강제한다.

- **app** — App Router 라우트/레이아웃 (auth 그룹, main 그룹, api Route Handler)
- **widgets** — board-view, card-detail-panel, app-shell, presence-cursors
- **features** — auth-sign-in, card-create, card-drag, board-create, workspace-create …
- **entities** — card, column, board, workspace, user, meeting (model/api/ui)
- **shared** — ui(shadcn), lib(cn, lexorank), api(supabase), config(env), types

### 핵심 설계 결정

- **position**: LexoRank 문자열 정렬 — 드래그 시 인접 두 항목만으로 O(1) 재배치 (명세 5.2)
- **충돌 감지**: moveCard 가 `updated_at` 비교로 동시 편집 감지, 불일치 시 낙관적 UI 롤백 (명세 10.2)
- **RLS**: 멤버십 헬퍼를 `SECURITY DEFINER` 함수로 만들어 정책 재귀 방지 (명세 5.3)
- **읽기=RSC/Server Action, 외부연동=Route Handler** (명세 6.1)

## 알려진 후속 작업

- 컬럼 드래그 재정렬 UI (서버 액션 `reorderColumn` 은 구현됨, dnd 연결만 후속)
- 멤버 초대 수락 흐름 (RLS/액션은 준비됨, 초대 UI 후속)
- M2~M4 외부 호출 본체 (자격증명 발급 후)
