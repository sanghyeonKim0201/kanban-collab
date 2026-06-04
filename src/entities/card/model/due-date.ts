/**
 * FR-03: 마감일(due_date) 입력 변환.
 * DB 의 due_date 는 timestamptz(ISO 문자열) 인데 UI 는 <input type="date"> 의
 * YYYY-MM-DD 만 다룬다. 둘 사이를 무손실에 가깝게 변환한다.
 */

/** ISO timestamptz → date input 값(YYYY-MM-DD). null/빈값이면 "". */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * date input 값(YYYY-MM-DD) → 저장용 ISO 문자열.
 * 빈값이면 null(마감일 해제). 해당 날짜의 자정(UTC)을 ISO 로 정규화한다.
 */
export function fromDateInputValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
