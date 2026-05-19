-- ════════════════════════════════════════════════════════════════
-- 0001_init.sql — 명세 5.1 ERD / 5.2 테이블 명세
-- ════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── user_profiles : auth.users 미러 (UI 표시용) ──────────────────
create table if not exists public.user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── workspaces ───────────────────────────────────────────────────
create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ── workspace_members ────────────────────────────────────────────
create table if not exists public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('owner','admin','member','guest')) default 'member',
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- ── boards ───────────────────────────────────────────────────────
create table if not exists public.boards (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  github_repo  text,
  created_at   timestamptz not null default now()
);

-- ── columns ──────────────────────────────────────────────────────
create table if not exists public.columns (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  name       text not null,
  position   text not null,                       -- LexoRank 기반 정렬
  created_at timestamptz not null default now()
);

-- ── cards (명세 5.2) ─────────────────────────────────────────────
create table if not exists public.cards (
  id          uuid primary key default gen_random_uuid(),
  column_id   uuid not null references public.columns(id) on delete cascade,
  title       text not null,
  description text,
  position    text not null,                      -- LexoRank 또는 float 기반 정렬
  priority    text check (priority in ('low','medium','high')) default 'medium',
  due_date    timestamptz,
  ai_category text,                                -- AI 자동 분류 결과
  github_url  text,                                -- 연결된 PR/Issue
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists cards_column_position_idx
  on public.cards(column_id, position);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cards_touch_updated_at on public.cards;
create trigger cards_touch_updated_at
  before update on public.cards
  for each row execute function public.touch_updated_at();

-- ── card_assignees ───────────────────────────────────────────────
create table if not exists public.card_assignees (
  id      uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unique (card_id, user_id)
);

-- ── labels ───────────────────────────────────────────────────────
create table if not exists public.labels (
  id       uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name     text not null,
  color    text not null default '#888888'
);

-- ── card_labels ──────────────────────────────────────────────────
create table if not exists public.card_labels (
  id       uuid primary key default gen_random_uuid(),
  card_id  uuid not null references public.cards(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  unique (card_id, label_id)
);

-- ── comments ─────────────────────────────────────────────────────
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

-- ── meetings ─────────────────────────────────────────────────────
create table if not exists public.meetings (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null,
  audio_url    text,
  transcript   text,
  summary      text,
  status       text not null check (status in ('pending','done')) default 'pending',
  created_at   timestamptz not null default now()
);

-- ── meeting_action_items ─────────────────────────────────────────
create table if not exists public.meeting_action_items (
  id                 uuid primary key default gen_random_uuid(),
  meeting_id         uuid not null references public.meetings(id) on delete cascade,
  card_id            uuid references public.cards(id) on delete set null,
  title              text not null,
  suggested_assignee text
);

-- ── github_events ────────────────────────────────────────────────
create table if not exists public.github_events (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.boards(id) on delete cascade,
  event_type   text not null,
  payload      jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Realtime 발행 (명세 6.3 board:{boardId} 채널 = cards/columns CDC)
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.columns;
