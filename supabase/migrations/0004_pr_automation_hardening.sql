-- ════════════════════════════════════════════════════════════════
-- 0004_pr_automation_hardening.sql
-- 설계 문서 섹션 11(알려진 한계) 후속 견고화:
--   1) 웹훅 delivery 멱등 키 (재전송/Redeliver 중복 처리 방지)
--   2) 동시 append position 충돌 감지 + 카드 이동 원자화 RPC
-- ════════════════════════════════════════════════════════════════

-- ── 1) 멱등 키: X-GitHub-Delivery (delivery id) ──────────────────
-- GitHub 의 at-least-once 재전송(자동 retry/UI Redeliver)은 동일 delivery id 를
-- 유지한다. 이미 적재된 delivery 는 route 진입부에서 early-return 하여
-- 활동로그 중복·수동 이동 되돌림을 막는다. unique 가 동시 경합의 백스톱.
-- (헤더 부재 시 null — Postgres unique 는 다중 null 을 허용하므로 degrade-safe.)
alter table public.github_events
  add column delivery_id text;

create unique index if not exists github_events_delivery_id_key
  on public.github_events (delivery_id)
  where delivery_id is not null;

-- ── 2) 동시 append position 충돌 감지 ────────────────────────────
-- 같은 컬럼 내 position 은 유일해야 한다. 두 웹훅이 동일 lastPos 를 읽어 같은
-- position 을 계산하면 이 제약이 unique_violation 으로 충돌을 감지하고, 아래 RPC
-- 가 이를 잡아 'conflict' 를 반환 → appendWithRetry 가 재조회·재계산해 재시도한다.
-- 기존 비유니크 인덱스(0001)는 이 unique 인덱스로 대체된다.
-- ⚠ 적용 전 같은 (column_id, position) 중복 행이 있으면 실패한다 — 그 자체가
--   본 마이그레이션이 막으려는 버그의 잔존이므로, 발생 시 데이터 정리 후 재적용.
drop index if exists public.cards_column_position_idx;

alter table public.cards
  add constraint cards_column_position_key unique (column_id, position);

-- ── 카드 이동 원자화 RPC ─────────────────────────────────────────
-- cards.update + board_activity.insert 를 단일 트랜잭션으로 묶어 부분 실패를
-- 제거한다(섹션 11 Minor). p_target_column_id 가 null 이면 배지만 갱신.
--
-- 반환값: 'ok' | 'conflict'.
--   동시 append 가 같은 (column_id, position) 을 점유하면 unique_violation 을
--   함수 안에서 직접 잡아 'conflict' 를 반환한다 — PostgREST/supabase-js 가
--   함수 내부 예외의 SQLSTATE 를 어떻게 표면화하든(에러 code 매핑) 무관하게
--   호출부(appendWithRetry)가 결과 문자열만으로 재시도를 판정할 수 있다.
--   예외 블록이 update/insert 를 롤백하므로 충돌 시 아무것도 기록되지 않는다.
create or replace function public.apply_pr_card_move(
  p_card_id           uuid,
  p_pr_state          text,
  p_target_column_id  uuid default null,
  p_position          text default null,
  p_board_id          uuid default null,
  p_activity_message  text default null
)
returns text
language plpgsql
set search_path = public
as $$
begin
  if p_target_column_id is not null then
    begin
      update public.cards
         set github_pr_state = p_pr_state,
             column_id       = p_target_column_id,
             position        = p_position
       where id = p_card_id;

      -- 카드가 동시에 삭제됐으면(0 행) 활동로그를 남기지 않는다
      -- (board_activity FK 위반 방지).
      if not found then
        return 'ok';
      end if;

      if p_activity_message is not null and p_board_id is not null then
        insert into public.board_activity (board_id, card_id, kind, message)
        values (p_board_id, p_card_id, 'pr_automation', p_activity_message);
      end if;
    exception
      when unique_violation then
        return 'conflict';
    end;
    return 'ok';
  else
    update public.cards
       set github_pr_state = p_pr_state
     where id = p_card_id;
    return 'ok';
  end if;
end;
$$;

-- 웹훅(service_role)만 호출. PostgREST 가 클라이언트(anon/authenticated)에게
-- 노출하지 않도록 기본 PUBLIC 권한을 회수한다.
revoke all on function public.apply_pr_card_move(uuid, text, uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.apply_pr_card_move(uuid, text, uuid, text, uuid, text)
  to service_role;
