import { describe, expect, test } from "vitest";
import { between } from "@/shared/lib/lexorank";
import { appendWithRetry } from "@/features/pr-automation/model/append-position";

/**
 * 동시 append position 충돌 회귀 (설계 문서 섹션 11).
 * 두 PR 웹훅이 거의 동시에 같은 타깃 컬럼 끝에 append 하면 동일 lastPos 를 읽어
 * 같은 position 을 계산 → 두 카드 동일 position. 이후 그 사이로 드롭하면
 * lexorank.between(a>=b) 가 throw → 드래그 실패.
 *
 * appendWithRetry 는 충돌(unique 위반) 감지 시 마지막 position 을 재조회하고
 * between(last,null) 을 재계산해 서로 다른 position 을 보장한다.
 */
describe("appendWithRetry — 동시 append 충돌 재시도", () => {
  /**
   * DB 의 "컬럼 마지막 카드" 상태를 흉내내는 인메모리 픽스처.
   * applyAt 은 position 이 이미 점유됐으면 conflict(=unique 위반)를 반환한다.
   */
  function makeColumn() {
    let last: string | null = null;
    const taken = new Set<string>();
    return {
      read: async () => last,
      apply: async (position: string) => {
        if (taken.has(position)) return { conflict: true };
        taken.add(position);
        last = position;
        return { conflict: false };
      },
      get lastValue() {
        return last;
      },
    };
  }

  test("동일 stale lastPos 를 읽은 두 mover 가 서로 다른, 정렬된 position 을 얻는다", async () => {
    const col = makeColumn();

    // Mover A: 정상 append (빈 컬럼).
    const posA = await appendWithRetry(col.read, col.apply);

    // Mover B: A 가 커밋되기 전 상태(null)를 한 번 더 읽었다고 가정 → 첫 시도는 A 와 동일 position 계산.
    // staleRead 가 첫 호출에 A 가 보기 전의 null 을 돌려주어 충돌을 강제한다.
    let first = true;
    const staleRead = async () => {
      if (first) {
        first = false;
        return null; // A 의 쓰기를 아직 못 본 stale 읽기
      }
      return col.read();
    };
    const posB = await appendWithRetry(staleRead, col.apply);

    expect(posA).not.toBe(posB);
    expect(posB > posA).toBe(true);
    // 회귀 핵심: 만약 중복이 허용됐다면 이후 between(posA, posB) 가 동작해야 하는데
    // posA===posB 였다면 between 이 throw → 드래그 실패. 서로 다르므로 안전.
    expect(() => between(posA, posB)).not.toThrow();
  });

  test("maxAttempts 초과 시 throw", async () => {
    // 항상 conflict 를 반환하는 apply → 재시도 한도 초과.
    const alwaysConflict = async () => ({ conflict: true });
    await expect(
      appendWithRetry(async () => "U", alwaysConflict, 3),
    ).rejects.toThrow();
  });

  test("충돌 없으면 한 번에 성공 (재시도 안 함)", async () => {
    const col = makeColumn();
    let reads = 0;
    const countingRead = async () => {
      reads++;
      return col.read();
    };
    const pos = await appendWithRetry(countingRead, col.apply);
    expect(typeof pos).toBe("string");
    expect(reads).toBe(1);
  });
});
