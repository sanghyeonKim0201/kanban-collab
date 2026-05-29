-- ════════════════════════════════════════════════════════════════
-- 0004_profile_embed_fks.sql
-- PostgREST 임베드(조인)용 FK.
--
-- 문제: workspace_members.user_id / card_assignees.user_id 는 auth.users 만
-- 참조하므로, PostgREST 가 public.user_profiles 로의 임베드 경로를 찾지 못해
-- "Could not find a relationship between '...' and 'user_profiles'" 로 실패한다.
--
-- 해법: user_profiles(id) 로의 FK 를 추가한다. user_profiles.id = auth.users.id
-- (1:1, 가입 트리거 handle_new_user 로 항상 생성)이므로 항상 충족된다.
-- 기존 auth.users FK 는 유지(임베드 대상이 다른 테이블이라 모호성 없음).
-- ════════════════════════════════════════════════════════════════

alter table public.workspace_members
  drop constraint if exists workspace_members_user_profile_fk;
alter table public.workspace_members
  add constraint workspace_members_user_profile_fk
  foreign key (user_id) references public.user_profiles(id) on delete cascade;

alter table public.card_assignees
  drop constraint if exists card_assignees_user_profile_fk;
alter table public.card_assignees
  add constraint card_assignees_user_profile_fk
  foreign key (user_id) references public.user_profiles(id) on delete cascade;
