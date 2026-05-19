/**
 * 명세 5.2: 카드/컬럼 position 을 LexoRank(문자열 기반) 으로 정렬.
 * 두 rank 사이에 항상 새 rank 를 삽입할 수 있어, 드래그앤드롭 시
 * 인접 두 항목만 알면 O(1) 로 position 을 계산한다 (전체 재배열 불필요).
 *
 * 알파벳: '0'~'z' (base-62 유사, 사전식 비교 = 위치 순서).
 */

const MIN_CHAR = "0".charCodeAt(0); // 48
const MAX_CHAR = "z".charCodeAt(0); // 122

const FIRST = "1"; // 경계 여유를 둔 시작
const LAST = "y"; // 경계 여유를 둔 끝

export function first(): string {
  return FIRST;
}

export function last(): string {
  return LAST;
}

/**
 * a < result < b 를 만족하는 문자열 반환.
 * a/b 가 null 이면 각각 리스트의 시작/끝 경계로 취급.
 */
export function between(a: string | null, b: string | null): string {
  const lo = a ?? "";
  const hi = b ?? "";

  if (a !== null && b !== null && a >= b) {
    throw new Error(`lexorank.between: 'a' (${a}) must be < 'b' (${b})`);
  }

  let result = "";
  let i = 0;

  for (;;) {
    const loCode = i < lo.length ? lo.charCodeAt(i) : MIN_CHAR;
    const hiCode =
      b === null
        ? MAX_CHAR + 1
        : i < hi.length
          ? hi.charCodeAt(i)
          : MAX_CHAR + 1;

    if (loCode === hiCode) {
      result += String.fromCharCode(loCode);
      i++;
      continue;
    }

    const mid = Math.floor((loCode + hiCode) / 2);
    if (mid === loCode) {
      // 인접 — lo 문자를 유지하고 다음 자리에서 더 파고든다.
      result += String.fromCharCode(loCode);
      i++;
      continue;
    }

    result += String.fromCharCode(mid);
    break;
  }

  return result;
}
