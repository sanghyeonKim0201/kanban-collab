# 최종 제출 핸드오프 (마감: 6/14 23:00)

> 제출물: **아래 3개 문서를 1개 PDF로 묶어** 제출.
> 근거 자료: `요구사항 명세서(김상현·김정환).docx`, `TaskFlow_요구분석_설계.pptx`, 코드베이스, git log.
> 팀: **김상현(프론트엔드·협업) · 김정환(백엔드·연동)**

---

## 0. 재활용 자료 맵

| 자료 | 위치 | 쓰임 |
|---|---|---|
| 요구사항 명세서(IEEE-830) | `요구사항 명세서 김상현 김정환.docx` | 1번 현황표(FR/NFR 원문) |
| 설계 발표 PPT(UML·아키텍처·패턴·역할) | `TaskFlow_요구분석_설계.pptx` | 1번·2번 |
| 시연 가이드 | `docs/DEMO_GUIDE.md` | 3번 |
| 발표 PDF(기능별 기술 상세·구조도) | `~/Downloads/TaskFlow_시연가이드.pdf` | 1번 기능설명·스니펫 |
| 트러블슈팅 기록 | `docs/solutions/**` | 2번 회고 |
| git 커밋(84개, FR 태그) | `git log` | 2번 커밋로그 |

시연 스크립트: `demo-start.command` · `demo-tunnel.command` · `demo-webhook.command`(백업)

---

## 1. 구현 결과 보고서

### 1-1. 설계 대비 구현 현황표 — 기능 요구사항 (FR-01~27)

> 명세서 3.1 원문 기준. 상태: ✅구현 / 🟡부분 / ❌미구현.

| FR | 요구사항(명세 원문) | 상태 | 근거(파일/커밋) | 사유·비고 |
|---|---|---|---|---|
| FR-01 | 보드 생성/관리(이름변경·삭제) | ✅ | board entities, `bdc91e0` | |
| FR-02 | 컬럼 관리(추가·수정·삭제·**순서변경**) | 🟡 | column entities, `reorderColumn` | 추가/수정/삭제·이름변경 O, **드래그 순서변경 UI 미연결**(액션은 존재) |
| FR-03 | 카드 생성(제목·설명·담당자·마감일·우선순위) | ✅ | card-create, `bdc91e0` | |
| FR-04 | 카드 수정/삭제 | ✅ | card-detail | |
| FR-05 | 드래그 앤 드롭 이동 | ✅ | board-view(dnd-kit), `move-card` | |
| FR-06 | 필터/검색(담당자·우선순위·마감일) | ✅ | board-filter, `5a4270b` | |
| FR-07 | 레이블 붙이기/떼기 | ✅ | `5ecf3f1` | |
| FR-08 | 댓글 작성·수정·삭제 | ✅ | `5ecf3f1` | 본인만 수정/삭제(RLS) |
| FR-09 | 활동 이력 자동 기록 | ✅ | `de74c1d`, board_activity | |
| FR-10 | 실시간 커서 | ✅ | use-collaboration(broadcast) | |
| FR-11 | 보드 동기화 | ✅ | use-board-realtime(CDC) | |
| FR-12 | 접속자 표시 | ✅ | use-collaboration(presence) | |
| FR-13 | 충돌 처리(동시 수정) | ✅ | moveCard updated_at, `2f5be4f` | 낙관적 롤백 |
| FR-14 | 저장소 연결 | ✅ | github-link-card, settings | |
| FR-15 | 커밋(push) 수신 | ✅ | webhooks/github | |
| FR-16 | PR 생성/머지/닫힘 반영 | ✅ | webhooks/github(apply_pr_card_move) | **라이브 검증** |
| FR-17 | 이슈 연동(이슈→카드) | ✅ | `042ac5a` | |
| FR-18 | 커밋-태스크 연결(TF-123) | ✅ | github-signature, `042ac5a` | |
| FR-19 | AI 카테고리 분류 | ✅ | shared/api/llm, api/ai/classify | |
| FR-20 | 우선순위 추천(마감일 반영) | ✅ | ai-classify-logic, `c1b027b` | |
| FR-21 | 담당자 추천 | ✅ | `c1b027b` | |
| FR-22 | 피드백 반영(few-shot) | ✅ | `c1b027b` | |
| FR-23 | 회의록 생성 | ✅ | summarizeMeeting, `61fe16d` | |
| FR-24 | 태스크 추출 | ✅ | extract-tasks | |
| FR-25 | 태스크 검토 후 추가 | ✅ | meeting-to-cards, `61fe16d` | |
| FR-26 | 회원가입/로그인(이메일·OAuth) | ✅(🟡) | auth-sign-in, middleware | 이메일 O, **OAuth는 localhost 리다이렉트 미설정**(코드 O) |
| FR-27 | 역할별 권한(관리자/편집자/뷰어) | ✅ | RLS, member-manage, `2f5be4f` | |

> **추가 구현(명세 외)**: 실시간 회의 음성인식(Web Speech)·화자 태그, 회의록 삭제, 시안 입력 버튼.

### 1-2. 설계 대비 구현 현황표 — 비기능 요구사항 (NFR-01~19)

| NFR | 목표 | 상태 | 비고 |
|---|---|---|---|
| NFR-01 로딩 ≤3초 / NFR-02 API ≤500ms / NFR-03 실시간 ≤200ms / NFR-04 AI ≤10초 | 성능 | 🟡 | 구조상 충족 지향, **실측 미수행** |
| NFR-05 20명 동접 / NFR-06 카드 1,000개 | 확장성 | 🟡 | 미측정(학교 과제 범위) |
| NFR-07 HTTP / NFR-08 JWT / NFR-09 bcrypt / NFR-10 Webhook 서명검증 | 보안 | ✅ | 전부 구현 (+ 전 테이블 RLS) |
| NFR-11 가용률 99% / NFR-12 30분 복구 | 가용성 | ❌ | 운영 인프라 미구성 |
| NFR-13 반응형 / NFR-14 쉬운 UI | 사용성 | 🟡 | PC 중심, 태블릿 검증 부분 |
| NFR-15 FSD 준수 | 유지보수 | ✅ | ESLint 경계 강제 |
| NFR-16 커버리지 70% | 유지보수 | 🟡 | 단위 테스트 **17개** 존재, **커버리지 수치 측정 미설정** |
| NFR-17 브라우저 2버전 / NFR-18 GitHub 호환 | 호환성 | 🟡 | Chrome 검증 중심 |
| NFR-19 매일 백업 7일 | 무결성 | ❌ | 미구성(Supabase 기본 의존) |

### 1-3. 주요 기능별 구현 설명 + 코드 스니펫

설명 본문 = 발표 PDF "기능별 기술 상세" 재사용. 각 기능에 스니펫 첨부:

| 기능 | 스니펫 파일 |
|---|---|
| 인증/세션 | `src/middleware.ts`, `features/auth-sign-in/ui/auth-form.tsx` |
| LLM 추상화(Strategy) | `src/shared/api/llm/index.ts` |
| AI 마감 후처리 | `src/shared/lib/ai-classify-logic.ts` |
| 정렬(LexoRank) | `src/shared/lib/lexorank.ts`, `entities/card/api/actions.ts` |
| 실시간(Observer) | `entities/board/model/use-board-realtime.ts`, `processes/realtime-collaboration/model/use-collaboration.ts` |
| 드래그 롤백(Memento) | `entities/board/model/store.ts`(snapshot/restore) |
| 웹훅 | `src/app/api/webhooks/github/route.ts`, `supabase/migrations/0004_*.sql` |
| 회의 요약 | `src/shared/api/llm/index.ts`(summarizeMeeting) |
| 실시간 회의 STT | `features/meeting-record/ui/upload-form.tsx` |
| RLS | `supabase/migrations/0002_rls.sql` |

---

## 2. 팀원별 기여도 보고서

### 2-1. 작업 분담표 (설계 PPT 11페이지 기준 — 확인 후 확정)

| 팀원 | 역할 | 담당 모듈/기능 (FR) | 담당 문서 |
|---|---|---|---|
| **김상현** | 프론트엔드 · 협업 | 칸반 보드 UI·드래그앤드롭(FR-01~06), 실시간 협업 커서·동기화(FR-10~13), 디자인 시스템·다크 테마, 필터/검색·레이블(FR-06·07) | 시연 가이드·발표자료 |
| **김정환** | 백엔드 · 연동 | DB 스키마·RLS 권한(FR-27), 인증 이메일·OAuth(FR-26), GitHub Webhook(FR-14~18), AI 분류·회의록 자동화(FR-19~25) | 요구사항 명세서 |

### 2-2. 개인별 커밋 로그 / 작업시간

- 전체 84커밋(5/19~6/6). 추출:
  - `git shortlog -sne` · `git log --pretty=format:'%h %ad %an %s' --date=short > commit-log.txt`
- ⚠️ **주의**: git 작성자가 `김상현`/`sanghyeonKim0201`/`kimsanghyeon`(동일 계정 추정) 한 명으로 잡힘. 김정환 담당분(BE/연동)도 같은 저장소에 커밋돼 있다면 **공동 작업/페어 프로그래밍**이었음을 명시하거나, 기능 단위로 분담을 서술해 보완.
- **커밋 → FR 매핑 시드**:
```
bdc91e0 보드/카드 속성(FR-01·03)   5a4270b 필터/검색(FR-06)
5ecf3f1 댓글·레이블(FR-07·08)      de74c1d 활동이력(FR-09)
2f5be4f 권한·충돌가드(FR-27·13)    c1b027b AI 우선순위·담당자·few-shot(FR-20·21·22)
61fe16d 회의록 구조화·태스크(FR-23·25)  042ac5a 커밋패턴·이슈→카드(FR-18·17)
8a81c03 웹훅 멱등·동시성   1833bc7 멤버 초대/역할(FR-26·27)
ac75d1c 실시간 회의·회의록 삭제   5f7a62a 멤버 액션 버그 수정
```

### 2-3. 팀 회고 (작성 프롬프트)

- **잘된 점**: FR 27개 완주 / AI·실시간·GitHub 라이브 / FSD·RLS 구조화 / 단위 테스트 17개 / 설계 패턴 4종 실제 적용.
- **어려웠던 점 (실제 기록 → `docs/solutions/`, 회고 소재로 인용)**:
  - 동시성·멱등 웹훅 자동화(concurrency-safe-webhook)
  - PostgREST FK 추가가 기존 임베드 깨뜨림(PGRST201)
  - PR 웹훅 배지 비-라이프사이클 회귀
  - 프로덕션에서 Server Action throw → 에러 오버레이 (결과 반환으로 수정)
- **개선 계획**: 컬럼 드래그 UI 완성 / 성능·커버리지 측정 / OAuth·배포 / E2E.

---

## 3. 시연 시나리오 문서

### 3-1. 시연 순서 · 입력값 · 기대 결과 (시드)

| # | 동작 | 입력값 | 기대 결과 |
|---|---|---|---|
| 0 | 로그인 | admin@admin.com / admin | 워크스페이스 진입 |
| 1 | 카드 추가(✨)·드래그 | 시안 자동 | 카드 생성·이동, 실시간 반영 |
| 2 | AI 추천 | "API 연동 작업" | 카테고리·우선순위·담당자 추천 |
| 3 | 카드 상세 | 레이블·댓글 | 저장, 댓글 본인만 수정 |
| 4 | 실시간 | 시크릿창=claude-test, 카드 이동 | 다른 창 즉시 반영+접속자 |
| 5 | GitHub | PR 머지 | 카드→Done 자동+🤖 로그 |
| 6 | 회의록 | 실시간 회의(✨/음성) | 요약·결정·할일 3개→카드 |
| 7 | 멤버 | 초대·역할변경 | 반영, 검증실패는 토스트 |

> 멘트·세부는 발표 PDF "시연 순서" + `DEMO_GUIDE.md` 재사용.

### 3-2. 시연 실패 시 대체 자료 (TODO: 촬영)

- **스크린샷 7장**: 로그인 / 보드(3컬럼) / AI 추천 / 실시간 2창 / PR머지→Done / 회의록 결과 / 멤버 관리
- **영상 1~2분**: ⭐4기능(AI분류·실시간·GitHub·AI회의록) 화면녹화
- **즉시 백업(구현됨)**: `./demo-webhook.command merged`(오프라인) · 회의록 텍스트탭+✨시안 · 완료된 "실시간 회의 데모(화자구분)" 예시

---

## 4. 부록 — 설계 자료 요약 (PPT에서, 보고서에 인용)

- **아키텍처**: 사용자(브라우저) ↔ Next.js 14(RSC·Client·Server Actions) ↔ Supabase BaaS(Postgres+RLS·Auth·Realtime·Storage) + GitHub Webhook + LLM/STT API. (구조도: 발표 PDF 마지막 장)
- **선택 근거**: BaaS=구축시간 절감 · RLS=보안 일원화(NFR) · FSD=유지보수(NFR-15) · Server Actions=보일러플레이트 제거.
- **UML**: 유스케이스(역할별 접근) · 클래스(Workspace→Board→Column→Card 1:N) · 시퀀스(카드 드래그 낙관적 UI + updated_at 충돌).
- **디자인 패턴 (발표한 4종 — 보고서에 동일하게)**:
  | 패턴 | 적용처 | 파일 | FR |
  |---|---|---|---|
  | Observer | Realtime 구독 전파 | `use-board-realtime.ts` | FR-11 |
  | Memento | 드래그 낙관적 롤백(snapshot/restore) | `board/model/store.ts` | FR-13 |
  | Strategy | LLM 공급자 추상화(런타임 교체) | `shared/api/llm/index.ts` | FR-19 |
  | Repository | 엔티티 데이터 접근 캡슐화 | `entities/*/api` | 공통 |

---

## 5. 1 PDF 병합 + 체크리스트

```bash
P=~/.claude/skills/gstack/make-pdf/dist/pdf
"$P" generate --cover --toc --title "TaskFlow 최종 제출" 합본.md out.pdf
# 또는 3개 md → 각 PDF → pdfunite a.pdf b.pdf c.pdf 최종.pdf
```

- [ ] 1-1 FR 27행 사유 확정 / 1-2 NFR 상태 검토 / 1-3 스니펫 첨부
- [ ] 2-1 분담표 확정(김상현·김정환) / 2-2 commit-log.txt / 2-3 회고 3항목
- [ ] 3-1 시나리오 표 / 3-2 스크린샷 7장 + 영상
- [ ] 3개 → 1 PDF, 6/14 23:00 전 제출
