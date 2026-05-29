# TaskFlow — 작업 핸드오프 문서

> **목적**: Claude Code에서 진행하던 작업을 새 세션(Claude.ai 챗 / Cowork / 다른 Claude Code 세션)으로 이어가기 위한 인수인계 문서.
> 새 대화 시작 시 이 문서를 통째로 붙여넣으면 맥락을 이어받을 수 있습니다.
> 작성 기준일: 2026-05-29

---

## 1. 프로젝트 한 줄 요약

**TaskFlow** — AI 기반 칸반 프로젝트 관리 도구. 학교 과제(프로젝트1)로, IEEE-Std-830 요구분석명세서(FR-01~27, NFR-01~19)를 기반으로 Next.js + Supabase로 구현 중. 13주차 발표는 "요구분석·설계"까지, 14주차에 구현 시연.

- **GitHub**: `https://github.com/sanghyeonKim0201/kanban-collab`
- **작업 브랜치**: `claude/gallant-perlman-09212b` (origin/main 기반)
- **팀**: 김상현 · 김정환

## 2. 기술 스택 / 아키텍처

- **프론트**: Next.js 14 App Router · TypeScript(strict) · Tailwind · shadcn 스타일 UI · dnd-kit · TanStack Query · Zustand · react-hook-form + zod
- **백엔드**: Supabase (Postgres · Auth · Realtime · Storage · RLS) — BaaS, 별도 서버 없음
- **아키텍처**: Feature-Sliced Design 6레이어 (`app > processes > widgets > features > entities > shared`) — ESLint `boundaries`로 단방향 의존 강제
- **CRUD**: Server Actions / 외부 수신: Route Handlers(`/api/*`)
- **실시간**: Supabase Realtime (Postgres CDC + Presence + Broadcast)

## 3. 저장소 구조 (요지)

```
src/
  app/          (auth)/login·signup, (main)/workspaces·board·meetings·settings, api/{webhooks,ai,meetings}
  processes/    realtime-collaboration
  widgets/      board-view, card-detail-panel, app-shell(사이드바), presence-cursors, meeting-panel
  features/     auth-sign-in, card-create, card-drag, card-label, column-create, board-create, ...
  entities/     board, column, card, label, meeting, workspace, user  (각 api/{queries,actions} = Repository 패턴)
  shared/       ui(shadcn), lib(lexorank, cn, ...), api/supabase(client/server/admin), config/env, types/database
supabase/migrations/  0001_init · 0002_rls · 0003_create_workspace_rpc · 0004_profile_embed_fks · 0005_position_c_collation
tests/unit/    lexorank, github-signature, move-card, ai-parse (vitest, 28 tests)
docs/superpowers/plans/2026-05-19-kanban-collab.md  ← 원래 구현 플랜(M1~M5)
```

## 4. 구현 현황 (명세 대비 — 엄격 기준)

### ✅ 구현 + UI 연결 (실제 동작 라이브 검증됨)
- 인증: 이메일 가입/로그인 + Google/GitHub OAuth 버튼 (FR-26), 역할 RLS (FR-27)
- 워크스페이스 CRUD, 보드 생성, 멤버 목록
- 칸반: 컬럼 추가·이름변경·삭제 (FR-02), 카드 생성 풀폼(설명·우선순위·마감일·담당자, FR-03)·수정·삭제(FR-04)
- 드래그앤드롭 + DragOverlay + 낙관적 UI + 충돌 감지 롤백 (FR-05/13)
- 필터/검색(텍스트·우선순위·담당자, FR-06), 레이블 생성/부착/제거(FR-07), 댓글 작성/삭제(FR-08)

### 🔑 코드 완성, 외부 키 넣으면 동작 (라이브 미검증)
- 실시간 커서/동기화/접속자 (FR-10~12) — 2탭 + Realtime 필요
- GitHub Webhook: 커밋·PR·커밋-태스크 연결 (FR-14~18) — `GITHUB_WEBHOOK_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` 필요
- AI 분류(카테고리·우선순위, FR-19/20), 회의록 요약/추출(FR-23~25) — `LLM_API_KEY`(키 없으면 휴리스틱 폴백)

### ❌ 미구현 (명세에 있으나 코드 없음)
- FR-09 활동 이력 자동 기록
- FR-21 AI 담당자 추천 / FR-22 추천 피드백 반영
- 멤버 초대·역할 변경 UI (멤버는 읽기 전용 표시만)
- 컬럼 순서 변경(reorderColumn 액션은 있으나 UI 미연결)
- NFR-16 테스트 커버리지 70%(현재 핵심 유틸 단위테스트 위주, 미달), NFR-13 반응형(데스크톱 전용)

## 5. Supabase 백엔드

- **프로젝트 ref**: `bjoqcgnfiqegvzdjlvog` (region ap-northeast-1) — 사용자 본인 계정, MCP로 연결됨
- **마이그레이션 0001~0005 적용 완료**: 전 테이블 + RLS(13테이블) + 트리거(handle_new_user, touch_updated_at) + Realtime 발행 + Storage 버킷
  - 0003: `create_workspace` RPC (생성 시 SELECT RLS 되읽기 닭-달걀 해소)
  - 0004: `user_profiles` 임베드 FK
  - 0005: position 컬럼 `COLLATE "C"` (lexorank ASCII 정렬 일치)
- **환경변수**: `.env.local` (git 무시됨). `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`(publishable) 설정됨. `SUPABASE_SERVICE_ROLE_KEY`는 **placeholder** — webhook/admin 기능 쓰려면 대시보드 Settings→API의 service_role 키로 교체 필요. LLM/STT/GitHub 시크릿은 비어 있음.
- **데모 계정**: `demo@taskflow.dev` / `taskflow123`, `admin@admin.com` / `admin123` (이메일 확인 처리됨)
- **주의**: 이 프로젝트는 Auth "Confirm email"이 켜져 있어, 신규 가입은 이메일 확인 후 로그인 가능.

## 6. 검증 상태 (모두 통과)

```bash
pnpm install
pnpm exec tsc --noEmit     # 타입체크 통과
pnpm exec vitest run       # 28 tests 통과
pnpm exec eslint .         # 클린 (FSD 경계 포함)
pnpm build                 # 프로덕션 빌드 성공 (단, dev 서버 떠 있을 때 동시 실행 금지 — .next 캐시 충돌)
pnpm dev                   # 로컬 구동 (preview 도구로 라이브 검증함)
```

⚠️ **알려진 함정**: dev 서버 실행 중 `pnpm build`를 돌리면 `.next/vendor-chunks` 캐시가 충돌해 "Cannot find module ..." 에러 발생. → dev 서버 멈추고 `rm -rf .next` 후 재시작하면 해결.

## 7. 발표 자료 (13주차)

- **결과물**: `~/Downloads/TaskFlow_요구분석_설계.pptx` (+ .pdf), 16:9, 11슬라이드
- **빌드 스크립트**: `/tmp/taskflow-ppt/build.js` (pptxgenjs, node로 실행 → pptx 생성). LibreOffice로 PDF/이미지 렌더 QA.
- **디자인**: Supabase 스타일 — 화이트 캔버스, near-black 텍스트, emerald green(#3ecf8e) 절제 액센트, Inter 폰트, 모노크롬 그레이, 1px 헤어라인. 헤더(챕터·제목·부제) 위치 고정.
- **구성**: ①개요 ②기능요구 ③비기능 ④유스케이스 ⑤클래스 ⑥시퀀스 ⑦아키텍처 ⑧패턴(GoF 4) ⑨역할·계획 + 타이틀/감사
- **슬라이드 노트**: 각 슬라이드에 [발표 멘트] + [예상 질문 33개 & 답변] 통합 (발표자 보기에서 확인)
- ⚠️ Inter 폰트가 발표 PC에 없으면 대체됨 → PowerPoint "파일에 글꼴 포함" 또는 PC에 Inter 설치 권장.

## 8. 남은 작업 (우선순위)

1. **3단계 외부 연동 실화**: service_role · LLM · GitHub 시크릿 키 넣고 실시간/Webhook/AI 실제 동작 검증 — **키 필요**
2. **4단계 미구현 기능**: 활동 이력(FR-09), AI 담당자 추천/피드백(FR-21/22), 멤버 초대·역할변경 UI, 컬럼 순서변경 UI
3. **품질(M5)**: Playwright e2e, 테스트 커버리지 70%, 반응형(모바일), Vercel 배포
4. **14주차 발표**: 구현 시연 자료

## 9. 새 세션(Claude.ai 챗)에서 이어갈 때 주의

- **챗은 로컬 파일 편집·셸 실행·Supabase MCP·dev 서버를 못 함** (분석/조언만). 코드를 실제로 빌드/실행/배포해야 하면 Claude Code 또는 Cowork(데스크톱 앱)을 쓸 것.
- 코드를 챗에서 보려면: GitHub(위 repo)에서 파일을 열거나, 스니펫/파일을 업로드.
- 발표자료 수정 논의: `.pptx`를 챗에 업로드해 피드백 받기 (단 재생성은 `/tmp/taskflow-ppt/build.js`를 가진 환경에서).
- 발표자료를 챗에서 다시 만들려면 위 빌드 스크립트 + 디자인 토큰(섹션 7)을 함께 전달할 것.
