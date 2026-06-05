-- ════════════════════════════════════════════════════════════════
-- 0008_member_management.sql — 명세 2.3 "관리자: 팀원 초대/관리"
-- owner/admin 이 이메일로 기존 가입 사용자를 멤버로 초대.
-- user_profiles SELECT RLS(profiles self read = true) 와 무관하게,
-- 이메일 조회는 SECURITY DEFINER 로 처리해 검색 경로를 안전하게 고정.
-- (workspace_members DELETE 정책은 0002 의 "wm manage delete" 로 이미 존재.)
-- ════════════════════════════════════════════════════════════════

-- 이메일로 기존 가입 사용자를 워크스페이스 멤버로 초대.
-- 반환값(text): 'ok' | 'forbidden' | 'not_found' | 'already_member' | 'bad_role'
create or replace function public.invite_member_by_email(
  p_workspace_id uuid,
  p_email text,
  p_role text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  -- 1) 호출자 권한 확인 — owner/admin 만 초대 가능.
  if public.workspace_role(p_workspace_id) not in ('owner', 'admin') then
    return 'forbidden';
  end if;

  -- 2) 역할 검증 — owner 부여 금지(보수적). admin/member/guest 만 허용.
  if p_role not in ('admin', 'member', 'guest') then
    return 'bad_role';
  end if;

  -- 3) 이메일로 가입 사용자 조회(대소문자 무시). 미가입이면 not_found.
  select id into v_target
  from public.user_profiles
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_target is null then
    return 'not_found';
  end if;

  -- 4) 이미 멤버면 중복 추가 금지.
  if exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = v_target
  ) then
    return 'already_member';
  end if;

  -- 5) 멤버 추가.
  insert into public.workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, v_target, p_role);

  return 'ok';
end;
$$;

revoke all on function public.invite_member_by_email(uuid, text, text) from public;
grant execute on function public.invite_member_by_email(uuid, text, text) to authenticated;
