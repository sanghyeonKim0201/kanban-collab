-- ════════════════════════════════════════════════════════════════
-- 0006_meeting_structured.sql
-- FR-23 회의록 구조화: meetings 에 structured jsonb 컬럼 추가.
--   참석자/안건/논의/결정사항/할 일을 구조화해 저장한다.
--   summary(text) 는 사람이 읽는 요약으로 그대로 유지.
--   RLS 는 meetings 기존 정책(0002)을 상속 — 별도 정책 불필요.
-- ════════════════════════════════════════════════════════════════

alter table public.meetings
  add column if not exists structured jsonb;
