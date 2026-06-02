-- ════════════════════════════════════════════════════════════════
-- 0003_pr_automation.sql — PR→컬럼 자동화 + PR 상태 배지 + 활동 로그
-- ════════════════════════════════════════════════════════════════

-- boards: 보드별 PR→컬럼 매핑 + 자동화 토글
alter table public.boards
  add column pr_automation_enabled boolean not null default false,
  add column pr_open_column_id uuid references public.columns(id) on delete set null,
  add column pr_merged_column_id uuid references public.columns(id) on delete set null;

-- cards: PR 상태 배지용
alter table public.cards
  add column github_pr_state text
    check (github_pr_state in ('open','merged','closed'));

-- 자동화 활동 로그 (토스트·피드 소스)
create table public.board_activity (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  kind text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index board_activity_board_created_idx
  on public.board_activity(board_id, created_at desc);

-- RLS: 워크스페이스 멤버만 조회. INSERT 정책 없음 → service_role(웹훅)만 삽입.
alter table public.board_activity enable row level security;

create policy "board_activity_select" on public.board_activity
  for select using (
    exists (
      select 1 from public.boards b
      where b.id = board_activity.board_id
        and public.is_workspace_member(b.workspace_id)
    )
  );

-- 실시간 구독 대상에 추가 (cards/columns 는 0001/0002 에서 이미 포함)
alter publication supabase_realtime add table public.board_activity;
