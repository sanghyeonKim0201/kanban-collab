-- ════════════════════════════════════════════════════════════════
-- 0003_create_workspace_rpc.sql
-- 워크스페이스 생성 부트스트랩 RPC.
--
-- 문제: workspaces 의 SELECT RLS 는 is_workspace_member(id) 인데,
-- 생성 직후엔 아직 멤버가 없어 INSERT ... RETURNING(.select()) 의
-- 되읽기가 거부되어 "violates RLS policy" 로 실패한다(닭-달걀).
--
-- 해법: 워크스페이스 + 생성자 owner 멤버십을 한 트랜잭션에 원자적으로
-- 처리하는 SECURITY DEFINER 함수. 부분 실패로 인한 고아 워크스페이스 방지.
-- ════════════════════════════════════════════════════════════════

create or replace function public.create_workspace(ws_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  clean_name text := nullif(btrim(ws_name), '');
begin
  if uid is null then
    raise exception '로그인이 필요합니다';
  end if;
  if clean_name is null then
    raise exception '이름을 입력하세요';
  end if;

  insert into public.workspaces (name)
  values (left(clean_name, 80))
  returning id into new_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_id, uid, 'owner');

  return new_id;
end;
$$;

revoke all on function public.create_workspace(text) from public;
grant execute on function public.create_workspace(text) to authenticated;
