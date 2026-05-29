-- ════════════════════════════════════════════════════════════════
-- 0005_position_c_collation.sql
-- LexoRank position 컬럼을 C(바이트) collation 으로 고정.
--
-- 문제: lexorank('0'~'z', 대문자 포함)는 JS 문자코드(ASCII) 순서를 가정하지만,
-- Postgres 기본 collation 은 대소문자를 다르게 정렬한다(예: 'h' < 'q' < 'U').
-- 그 결과 .order('position') 이 컬럼/카드 순서를 뒤집는다.
--
-- 해법: position 컬럼을 COLLATE "C" 로 바꿔 바이트 순서 정렬 = JS 비교와 일치.
-- ════════════════════════════════════════════════════════════════

alter table public.columns
  alter column position type text collate "C";

alter table public.cards
  alter column position type text collate "C";
