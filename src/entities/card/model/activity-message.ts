/**
 * FR-09: 카드 변경 활동 이력 메시지 생성(순수 로직).
 *
 * board_activity 피드에 남길 사람이 읽는 한 줄 문장을 만든다. 부수효과 없는
 * 순수 함수라 단위 테스트로 문구 회귀를 잡는다. 실제 insert 는 logActivity
 * (src/entities/board/api/activity.ts)가 담당하고, kind 는 'card_change' 통일.
 */

export type CardUpdateField =
  | "title"
  | "description"
  | "priority"
  | "due_date"
  | "ai_category"
  | "github_url";

const FIELD_LABELS: Record<CardUpdateField, string> = {
  title: "제목",
  description: "설명",
  priority: "우선순위",
  due_date: "마감일",
  ai_category: "분류",
  github_url: "GitHub 링크",
};

/** 카드 생성 로그: "📝 '제목' 카드 생성" */
export function cardCreatedMessage(title: string): string {
  return `📝 '${title}' 카드 생성`;
}

/** 카드 삭제 로그: "🗑️ '제목' 카드 삭제" (제목 미상이면 일반화) */
export function cardDeletedMessage(title: string | null | undefined): string {
  return title ? `🗑️ '${title}' 카드 삭제` : "🗑️ 카드 삭제";
}

/** 카드 이동 로그: "↔️ '제목' 카드를 '컬럼'(으)로 이동" */
export function cardMovedMessage(
  title: string | null | undefined,
  columnName: string | null | undefined,
): string {
  const head = title ? `'${title}' 카드를` : "카드를";
  return columnName
    ? `↔️ ${head} '${columnName}'(으)로 이동`
    : `↔️ ${head} 이동`;
}

/**
 * 카드 수정 로그: 변경된 필드 라벨을 모아 "✏️ '제목' — 제목·우선순위 수정".
 * 변경 필드를 못 추리면(빈 배열) "✏️ '제목' 카드 수정"으로 일반화.
 */
export function cardUpdatedMessage(
  title: string | null | undefined,
  changedFields: CardUpdateField[],
): string {
  const head = title ? `'${title}'` : "카드";
  const labels = changedFields
    .map((f) => FIELD_LABELS[f])
    .filter((l): l is string => Boolean(l));
  if (labels.length === 0) {
    return `✏️ ${head} 카드 수정`;
  }
  return `✏️ ${head} — ${labels.join("·")} 수정`;
}
