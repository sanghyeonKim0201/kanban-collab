# 컬럼 커스터마이즈 UI 설계 스펙

작성일: 2026-06-02
대상: 칸반 보드 컬럼(상태) 추가/이름변경/삭제/재정렬 UI

> 이 스펙은 "컬럼 커스터마이즈 + 워크플로우 자동화" 중 **하위기능 1 (컬럼 UI)** 만 다룬다.
> 자동화(GitHub 이벤트 → 카드 자동 이동)는 컬럼 UI 가 동작한 뒤 별도 스펙으로 설계한다.

## 1. 목표 & 배경

- **목표:** 사용자가 보드의 컬럼(워크플로우 단계)을 직접 추가·이름변경·삭제·재정렬할 수 있게 한다. Jira/Linear/Trello 처럼.
- **배경 — 백엔드는 이미 있음:** `src/entities/column/api/actions.ts` 에 `createColumn`/`renameColumn`/`reorderColumn`/`deleteColumn` 4종 서버액션이 구현돼 있다. **UI(버튼·인라인 편집·드래그)만 없다.** 이번 작업은 그 UI 를 붙이는 것.
- **재사용:** LexoRank `between()`, zustand 보드 스토어, dnd-kit, 실시간 구독.

## 2. 결정 사항 (확정)

| 결정 | 내용 |
| --- | --- |
| 인터랙션 | **인라인** (Linear/Trello). 헤더 더블클릭=이름변경, 헤더 ⋯ 메뉴=삭제, 컬럼들 맨 오른쪽 `+ 컬럼 추가` |
| 삭제 정책 | **카드 0개일 때만 삭제 가능.** 카드가 있으면 삭제 비활성 + "카드를 먼저 옮기거나 삭제하세요" 안내 |
| 권한 | **owner/admin 만** 편집 UI 노출 (member 는 읽기). 기존 RLS(`columns write` = owner/admin)와 일치 |
| 재정렬 | **포함.** 컬럼 헤더 수평 드래그로 순서 변경 (`reorderColumn` 재사용) |
| 데이터 흐름 | 낙관적 스토어 업데이트 → 서버액션 → 실패 시 토스트 + 롤백. 카드 이동 패턴과 동일 |

## 3. 스코프 / 논-골

### 바꾼다
- `src/entities/board/model/store.ts` — 컬럼 낙관적 변경 메서드 추가
- `src/widgets/board-view/ui/board-column.tsx` — 헤더에 인라인 편집/메뉴/드래그 핸들
- `src/widgets/board-view/ui/board-view.tsx` — DndContext 에 컬럼 SortableContext(수평) 추가, onDragEnd 타입 분기
- `src/features/card-drag/model/use-card-dnd.ts` — onDragEnd 에서 컬럼 이동 분기 (또는 신규 훅 분리)
- 신규 `src/features/column-edit/` 슬라이스 — 인라인 편집 UI 컴포넌트
- `src/app/(main)/board/[boardId]/page.tsx` — 현재 유저 role 을 BoardView 로 전달 (편집 권한 판정용)

### 안 바꾼다 (논-골)
- DB 스키마/RLS/마이그레이션 (전부 이미 충분)
- 서버액션 4종 시그니처
- 카드 dnd 의 카드 이동 로직 (컬럼 분기만 추가)
- 워크플로우 자동화 (하위기능 2)
- 컬럼 색상, WIP 제한, 기본 프리셋 등 부가기능 (YAGNI)

## 4. 컴포넌트 설계

### 4.1 신규 슬라이스 `features/column-edit/`
- `ui/column-header.tsx` — 컬럼 헤더(이름 + 카운트 + ⋯ 메뉴 + 드래그 핸들). owner/admin 일 때만 편집 가능, 아니면 정적 헤더.
  - 더블클릭 → 인라인 input(현재 이름 프리필) → Enter/blur 저장(`renameColumn`), Esc 취소.
  - ⋯ 드롭다운: "이름 변경"(input 진입), "삭제"(카드 0개일 때만 활성).
  - 드래그 핸들(예: `GripVertical` 아이콘, 또는 헤더 자체) → 컬럼 정렬.
- `ui/add-column.tsx` — 컬럼 목록 맨 오른쪽 `+ 컬럼 추가` 고스트. 클릭 → 인라인 input → 입력 후 `createColumn`(맨 끝).
- `model/use-column-edit.ts` — rename/delete/add 액션을 낙관적 업데이트 + 토스트로 래핑.

### 4.2 보드 스토어 확장 (`entities/board/model/store.ts`)
카드 메서드(`moveCardLocal` 등)와 동일 패턴으로 추가:
- `addColumnLocal(column)` — 임시 컬럼 삽입(맨 끝), 스냅샷 반환
- `renameColumnLocal(id, name)` — 스냅샷 반환
- `removeColumnLocal(id)` — 스냅샷 반환
- `reorderColumnLocal(id, toIndex)` — 스냅샷 반환
- 모두 실패 시 기존 `restore(snapshot)` 로 롤백

### 4.3 dnd 타입 분기
- 컬럼 헤더에 `useSortable({ id: column.id, data: { type: "column" } })` (수평 정렬).
  - 주의: 현재 droppable 컬럼 data 는 `{ type: "column", columnId }`. 충돌 방지를 위해 **컬럼 정렬용 sortable 은 `type: "column-sort"`** 로 명명.
- `board-view.tsx`:
  - 컬럼들을 `SortableContext`(horizontalListSortingStrategy)로 감싼다.
  - `onDragEnd` 에서 `active.data.current?.type` 분기:
    - `"card"` → 기존 카드 이동 로직
    - `"column-sort"` → 컬럼 재정렬: 두 컬럼 사이 LexoRank `between()` 계산 → `reorderColumn` → 낙관적 `reorderColumnLocal`
- **드래그 핸들 분리**로 카드/컬럼 드래그 혼동 방지: 컬럼 헤더의 명시적 핸들(GripVertical)에서만 컬럼 드래그 시작. 카드 드래그는 카드 본문(기존)에서.

## 5. 데이터 흐름 (예: 컬럼 이름변경)

```
사용자 더블클릭 → input 편집 → Enter
  → renameColumnLocal(id, newName)  // 낙관적, snapshot 보관
  → renameColumn(id, newName, boardId)  // 서버액션 (RLS: owner/admin)
      성공 → revalidate + 실시간 broadcast 로 타 클라이언트 반영
      실패 → restore(snapshot) + toast(에러)
```

- **컬럼 추가:** 클라가 임시 id 로 낙관적 삽입 → 서버액션이 실제 row 생성 → 실시간/revalidate 로 실제 id 동기화. (임시 id 충돌 방지: 서버 응답 후 setBoard 재동기화로 단순화 가능 — 구현 시 택1)
- **삭제 가드:** UI 에서 카드>0 이면 삭제 비활성. 서버액션에도 방어적으로 카드 존재 검사 추가(선택) — RLS 는 권한만 막고 카드 존재는 안 막으므로, `deleteColumn` 에 "카드 있으면 거부" 가드를 더하면 안전. (cascade 사고 방지)

## 6. 권한 처리

- `board/[boardId]/page.tsx` 에서 현재 유저의 워크스페이스 role 조회(`workspace_members`)해 `canEditColumns = role in (owner, admin)` 를 BoardView → BoardColumn 으로 전달.
- `canEditColumns=false` 면 편집 UI(더블클릭/⋯/+추가/드래그 핸들) 미렌더 — 정적 헤더만.
- 서버액션은 RLS 가 최종 방어선(member 가 우회 시도해도 DB 가 거부).

## 7. 엣지 케이스

- **마지막 컬럼 삭제:** 보드에 컬럼이 1개뿐이어도 삭제 허용? → 허용하되 빈 보드 시 "컬럼을 추가하세요" 안내(EmptyState). (카드 0개일 때만 삭제 가능하므로 데이터 손실 없음)
- **이름 빈 값/공백:** `nameSchema`(trim, min 1, max 80)가 거부 → 토스트.
- **동시 편집 충돌:** 컬럼은 카드처럼 updated_at 비교가 없음. 실시간 broadcast 로 최신화하되, 단순 last-write-wins 허용(컬럼 변경은 드묾). 향후 필요 시 강화.
- **재정렬 중 실시간 수신:** 드래그 진행 중 타 유저 변경 수신 시 깜빡임 가능 — 드래그 종료 후 동기화로 단순화.

## 8. 테스트

- **순수 로직(단위, vitest):** 컬럼 재정렬 position 계산(두 컬럼 사이 `between`), 삭제 가드(카드 0개 판정). store 의 `reorderColumnLocal`/`removeColumnLocal` 가 스냅샷을 올바로 반환하는지.
- **기존 테스트 불변:** lexorank/move-card 등 35개 green 유지.

## 9. 구현 순서 (개략)

1. 보드 스토어 컬럼 메서드 + 단위 테스트
2. `column-edit` 슬라이스(헤더 인라인 편집 + add-column) — 권한 분기
3. dnd 컬럼 재정렬(타입 분기 + 수평 SortableContext)
4. page 에서 role 전달, 권한 게이팅
5. `deleteColumn` 카드-존재 가드(선택)
6. dev 프리뷰 검수(추가/이름변경/삭제차단/재정렬/권한)

## 10. 확정 필요 (스펙 리뷰)

1. 컬럼 추가 낙관적 처리: 임시 id 삽입 vs 서버 응답 후 재동기화 — 구현 단순성 기준 택1(기본: 재동기화).
2. `deleteColumn` 서버 가드 추가 여부 — 권장(데이터 안전).

기본값(권장): 재동기화 / 서버 가드 추가.
