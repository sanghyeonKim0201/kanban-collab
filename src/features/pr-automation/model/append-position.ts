import { between } from "@/shared/lib/lexorank";

/** Postgres unique_violation SQLSTATE — 동시 append 가 같은 position 을 점유했을 때. */
export const UNIQUE_VIOLATION = "23505";

/**
 * 컬럼 끝(append)에 카드를 배치할 때의 동시성 안전 재시도.
 *
 * 설계 문서 섹션 11: 두 PR 웹훅이 거의 동시에 같은 타깃 컬럼 끝에 append 하면
 * 동일 lastPos 를 읽어 같은 position 을 계산 → 두 카드 동일 position →
 * 이후 그 사이로 드롭 시 lexorank.between(a>=b) 가 throw → 드래그 실패.
 *
 * `cards(column_id, position)` unique 제약이 충돌을 감지하면(RPC 가 'conflict' 반환)
 * 마지막 position 을 재조회하고 between(last,null) 을 재계산해 다시 시도한다.
 *
 * between(last,null) 은 항상 last(=현재 컬럼 최대값)보다 strictly 크므로, 컬럼 내
 * 모든 기존 position 보다 크다 → 비최대 카드와는 충돌할 수 없고, 오직 동시
 * append 끼리만 충돌한다. 충돌한 쪽이 커밋되면 last 가 갱신되어 재계산값이 다시
 * strictly 커지므로 재시도는 항상 진전한다(무한 루프 없음).
 *
 * @param readLastPosition 타깃 컬럼의 현재 마지막(최대) position. 빈 컬럼이면 null.
 * @param applyAt          계산된 position 으로 이동 적용. unique 위반이면 `{conflict:true}`.
 * @returns 최종 확정된 position.
 */
export async function appendWithRetry(
  readLastPosition: () => Promise<string | null>,
  applyAt: (position: string) => Promise<{ conflict: boolean }>,
  maxAttempts = 5,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const last = await readLastPosition();
    const position = between(last, null);
    const { conflict } = await applyAt(position);
    if (!conflict) return position;
    if (attempt >= maxAttempts) {
      throw new Error(
        `append position 충돌이 ${maxAttempts}회 재시도 후에도 해소되지 않음`,
      );
    }
  }
}
