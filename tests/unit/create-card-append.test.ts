import { describe, expect, test } from "vitest";
import { between } from "@/shared/lib/lexorank";
import { appendWithRetryReturning } from "@/shared/lib/append-position";

/**
 * createCard 동시 생성 충돌 회귀.
 *
 * cards(column_id, position) unique 제약(마이그레이션 0004) 하에서 두 사용자가
 * 거의 동시에 같은 컬럼 끝에 카드를 만들면 동일 lastPos 를 읽어 같은
 * between(last,null) position 을 계산 → 두 번째 insert 가 unique_violation(23505).
 *
 * appendWithRetryReturning 은 appendWithRetry 의 값-반환 변형으로, 충돌 감지 시
 * lastPos 재조회 + between 재계산으로 재시도하면서 성공한 insert 의 식별자(새 카드
 * id)를 position 과 함께 돌려준다. createCard 는 이 id 를 호출자에게 반환해야 한다.
 */
describe("appendWithRetryReturning — createCard 동시 생성 재시도", () => {
  /**
   * cards 테이블 insert 를 흉내내는 인메모리 픽스처.
   * position 이 이미 점유됐으면(=다른 동시 insert 가 선점) conflict 를 반환하고,
   * 비면 새 id 를 발급하며 컬럼 last 를 갱신한다.
   */
  function makeCards() {
    let last: string | null = null;
    let seq = 0;
    const taken = new Set<string>();
    return {
      read: async () => last,
      insertAt: async (position: string) => {
        if (taken.has(position)) {
          return { conflict: true as const };
        }
        taken.add(position);
        last = position;
        return { conflict: false as const, value: `card-${++seq}` };
      },
    };
  }

  test("충돌 없으면 한 번에 성공하며 새 카드 id 와 position 을 반환한다", async () => {
    const cards = makeCards();
    let reads = 0;
    const countingRead = async () => {
      reads++;
      return cards.read();
    };

    const { position, value } = await appendWithRetryReturning(
      countingRead,
      cards.insertAt,
    );

    expect(value).toBe("card-1");
    expect(typeof position).toBe("string");
    expect(reads).toBe(1); // 재시도 없음
  });

  test("stale lastPos 로 충돌한 두 번째 생성이 재시도해 서로 다른 정렬된 position 과 올바른 id 를 얻는다", async () => {
    const cards = makeCards();

    // 사용자 A: 빈 컬럼에 정상 생성.
    const a = await appendWithRetryReturning(cards.read, cards.insertAt);

    // 사용자 B: A 커밋 전의 상태(null)를 한 번 더 읽어 첫 시도는 A 와 동일 position →
    // unique_violation → 재조회 후 재시도.
    let first = true;
    const staleRead = async () => {
      if (first) {
        first = false;
        return null; // A 의 쓰기를 아직 못 본 stale 읽기
      }
      return cards.read();
    };
    const b = await appendWithRetryReturning(staleRead, cards.insertAt);

    // 서로 다른, 정렬된 position — 이후 그 사이 드롭 시 between 이 동작.
    expect(a.position).not.toBe(b.position);
    expect(b.position > a.position).toBe(true);
    expect(() => between(a.position, b.position)).not.toThrow();

    // 재시도 후에도 "성공한" insert 의 id 를 정확히 돌려준다(첫 충돌 시도의 id 가 아님).
    expect(a.value).toBe("card-1");
    expect(b.value).toBe("card-2");
  });

  test("maxAttempts 초과 시 throw", async () => {
    const alwaysConflict = async () => ({ conflict: true as const });
    await expect(
      appendWithRetryReturning(async () => "U", alwaysConflict, 3),
    ).rejects.toThrow();
  });
});
