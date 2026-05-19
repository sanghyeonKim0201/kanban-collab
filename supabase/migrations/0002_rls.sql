-- ════════════════════════════════════════════════════════════════
-- 0002_rls.sql — 명세 5.3 / 9.2 권한 매트릭스
-- 모든 테이블 RLS 활성화. 워크스페이스 멤버십 기준 접근 제어.
-- ════════════════════════════════════════════════════════════════

-- 멤버십 헬퍼: SECURITY DEFINER 로 RLS 우회 → 정책 재귀 방지
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.workspace_role(ws uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid()
  limit 1;
$$;

-- board → workspace 매핑 헬퍼
create or replace function public.board_workspace(b uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.boards where id = b;
$$;

-- card → workspace 매핑 헬퍼
create or replace function public.card_workspace(c uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.workspace_id
  from public.cards cd
  join public.columns col on col.id = cd.column_id
  join public.boards b on b.id = col.board_id
  where cd.id = c;
$$;

-- ── 활성화 ───────────────────────────────────────────────────────
alter table public.user_profiles        enable row level security;
alter table public.workspaces           enable row level security;
alter table public.workspace_members    enable row level security;
alter table public.boards               enable row level security;
alter table public.columns              enable row level security;
alter table public.cards                enable row level security;
alter table public.card_assignees       enable row level security;
alter table public.labels               enable row level security;
alter table public.card_labels          enable row level security;
alter table public.comments             enable row level security;
alter table public.meetings             enable row level security;
alter table public.meeting_action_items enable row level security;
alter table public.github_events        enable row level security;

-- ── user_profiles : 본인 + 같은 워크스페이스 동료 조회 ───────────
create policy "profiles self read" on public.user_profiles
  for select using (true);
create policy "profiles self update" on public.user_profiles
  for update using (id = auth.uid());

-- ── workspaces ───────────────────────────────────────────────────
create policy "ws members read" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "ws any insert" on public.workspaces
  for insert with check (auth.uid() is not null);
create policy "ws owner update" on public.workspaces
  for update using (public.workspace_role(id) = 'owner');
create policy "ws owner delete" on public.workspaces
  for delete using (public.workspace_role(id) = 'owner');

-- ── workspace_members ────────────────────────────────────────────
create policy "wm members read" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
-- 워크스페이스 생성자 셀프 부트스트랩 OR owner/admin 의 멤버 초대
create policy "wm insert" on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    or public.workspace_role(workspace_id) in ('owner','admin')
  );
create policy "wm manage update" on public.workspace_members
  for update using (public.workspace_role(workspace_id) in ('owner','admin'));
create policy "wm manage delete" on public.workspace_members
  for delete using (public.workspace_role(workspace_id) in ('owner','admin'));

-- ── boards : 조회=멤버, 생성/삭제=owner/admin (명세 9.2) ──────────
create policy "boards read" on public.boards
  for select using (public.is_workspace_member(workspace_id));
create policy "boards insert" on public.boards
  for insert with check (public.workspace_role(workspace_id) in ('owner','admin'));
create policy "boards update" on public.boards
  for update using (public.workspace_role(workspace_id) in ('owner','admin'));
create policy "boards delete" on public.boards
  for delete using (public.workspace_role(workspace_id) in ('owner','admin'));

-- ── columns : 조회=멤버, 구조변경=owner/admin ────────────────────
create policy "columns read" on public.columns
  for select using (public.is_workspace_member(public.board_workspace(board_id)));
create policy "columns write" on public.columns
  for all
  using (public.workspace_role(public.board_workspace(board_id)) in ('owner','admin'))
  with check (public.workspace_role(public.board_workspace(board_id)) in ('owner','admin'));

-- ── cards : 조회=멤버(명세 5.3), 생성/수정/이동=member 이상 ───────
create policy "members can read cards" on public.cards
  for select using (
    exists (
      select 1
      from public.columns c
      join public.boards b on b.id = c.board_id
      join public.workspace_members m on m.workspace_id = b.workspace_id
      where c.id = cards.column_id and m.user_id = auth.uid()
    )
  );
create policy "cards insert" on public.cards
  for insert with check (
    public.workspace_role(
      public.board_workspace((select board_id from public.columns where id = column_id))
    ) in ('owner','admin','member')
  );
create policy "cards update" on public.cards
  for update using (
    public.workspace_role(
      public.board_workspace((select board_id from public.columns where id = column_id))
    ) in ('owner','admin','member')
  );
create policy "cards delete" on public.cards
  for delete using (
    public.workspace_role(
      public.board_workspace((select board_id from public.columns where id = column_id))
    ) in ('owner','admin','member')
  );

-- ── card_assignees ───────────────────────────────────────────────
create policy "assignees read" on public.card_assignees
  for select using (public.is_workspace_member(public.card_workspace(card_id)));
create policy "assignees write" on public.card_assignees
  for all
  using (public.workspace_role(public.card_workspace(card_id)) in ('owner','admin','member'))
  with check (public.workspace_role(public.card_workspace(card_id)) in ('owner','admin','member'));

-- ── labels ───────────────────────────────────────────────────────
create policy "labels read" on public.labels
  for select using (public.is_workspace_member(public.board_workspace(board_id)));
create policy "labels write" on public.labels
  for all
  using (public.workspace_role(public.board_workspace(board_id)) in ('owner','admin','member'))
  with check (public.workspace_role(public.board_workspace(board_id)) in ('owner','admin','member'));

-- ── card_labels ──────────────────────────────────────────────────
create policy "card_labels read" on public.card_labels
  for select using (public.is_workspace_member(public.card_workspace(card_id)));
create policy "card_labels write" on public.card_labels
  for all
  using (public.workspace_role(public.card_workspace(card_id)) in ('owner','admin','member'))
  with check (public.workspace_role(public.card_workspace(card_id)) in ('owner','admin','member'));

-- ── comments ─────────────────────────────────────────────────────
create policy "comments read" on public.comments
  for select using (public.is_workspace_member(public.card_workspace(card_id)));
create policy "comments insert" on public.comments
  for insert with check (
    author_id = auth.uid()
    and public.workspace_role(public.card_workspace(card_id)) in ('owner','admin','member')
  );
create policy "comments delete own" on public.comments
  for delete using (author_id = auth.uid());

-- ── meetings : 업로드=member 이상 (명세 9.2) ─────────────────────
create policy "meetings read" on public.meetings
  for select using (public.is_workspace_member(workspace_id));
create policy "meetings write" on public.meetings
  for all
  using (public.workspace_role(workspace_id) in ('owner','admin','member'))
  with check (public.workspace_role(workspace_id) in ('owner','admin','member'));

-- ── meeting_action_items ─────────────────────────────────────────
create policy "mai read" on public.meeting_action_items
  for select using (
    public.is_workspace_member(
      (select workspace_id from public.meetings where id = meeting_id)
    )
  );
create policy "mai write" on public.meeting_action_items
  for all
  using (
    public.workspace_role(
      (select workspace_id from public.meetings where id = meeting_id)
    ) in ('owner','admin','member')
  )
  with check (
    public.workspace_role(
      (select workspace_id from public.meetings where id = meeting_id)
    ) in ('owner','admin','member')
  );

-- ── github_events : 조회=owner/admin, 쓰기는 service_role 만 ──────
create policy "ghe read" on public.github_events
  for select using (public.workspace_role(public.board_workspace(board_id)) in ('owner','admin'));
