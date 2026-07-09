-- CueTasks — Supabase schema (v1)
-- Postgres + Row-Level Security. Run in the Supabase SQL editor, or drop into
-- supabase/migrations/ and apply with the Supabase CLI.
--
-- Design notes:
--  * A category doubles as a shareable "list" (category_members). Individual
--    tasks can also be shared directly (task_shares).
--  * Cross-table access checks use SECURITY DEFINER helper functions so RLS
--    policies don't recurse into each other.
--  * Clients (web/phone PWA) authenticate as the end user via Supabase Auth.
--    The Hermes MCP server authenticates server-side with a service credential
--    and passes an explicit owner user_id (see docs/backend-architecture.md).

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ─────────────────────────── profiles ───────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email        text,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────── user_settings ───────────────────────────
create table public.user_settings (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  theme         text not null default 'dark' check (theme in ('dark','light')),
  -- Notification preferences (consumed by the PWA's alertUser/reminderChecker).
  notifications jsonb not null default
    '{"sound":true,"vibrate":true,"notify_before":true,"notify_on_due":true}'::jsonb,
  -- Outbound email digest config. scope: 'all' | 'categories' | 'tasks'.
  email_digest  jsonb not null default
    '{"enabled":false,"frequency":"daily","send_at":"07:00","scope":"all","category_ids":[],"task_ids":[]}'::jsonb,
  updated_at    timestamptz not null default now()
);

-- ─────────────────────────── categories (also a shareable list) ───────────────────────────
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#6366f1',
  icon       text,
  created_at timestamptz not null default now()
);
create index categories_owner_idx on public.categories(owner_id);

create table public.category_members (
  category_id uuid not null references public.categories(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'viewer' check (role in ('viewer','editor')),
  created_at  timestamptz not null default now(),
  primary key (category_id, user_id)
);
create index category_members_user_idx on public.category_members(user_id);

-- ─────────────────────────── tasks ───────────────────────────
create table public.tasks (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references auth.users(id) on delete cascade,
  category_id            uuid references public.categories(id) on delete set null,
  title                  text not null,
  notes                  text,
  due_at                 timestamptz,
  completed              boolean not null default false,
  completed_at           timestamptz,
  starred                boolean not null default false,
  sort_order             int not null default 0,
  reminder_enabled       boolean not null default false,
  reminder_minutes_before int not null default 15,
  recurrence             jsonb,        -- matches the app's RecurrencePattern
  series_id              uuid,         -- links occurrences of a recurring task
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index tasks_owner_idx    on public.tasks(owner_id);
create index tasks_category_idx on public.tasks(category_id);
create index tasks_due_idx      on public.tasks(due_at);

create table public.task_shares (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'viewer' check (role in ('viewer','editor')),
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_shares_user_idx on public.task_shares(user_id);

-- ─────────────────────────── triggers ───────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger tasks_touch    before update on public.tasks
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- Bootstrap a profile + settings row when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── access helpers (SECURITY DEFINER, bypass RLS) ───────────────────────────
create or replace function public.is_category_member(cat uuid, need_editor boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.category_members m
    where m.category_id = cat and m.user_id = auth.uid()
      and (not need_editor or m.role = 'editor')
  );
$$;

create or replace function public.is_task_shared(t uuid, need_editor boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.task_shares s
    where s.task_id = t and s.user_id = auth.uid()
      and (not need_editor or s.role = 'editor')
  );
$$;

-- ─────────────────────────── row-level security ───────────────────────────
alter table public.profiles         enable row level security;
alter table public.user_settings    enable row level security;
alter table public.categories       enable row level security;
alter table public.category_members enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_shares      enable row level security;

-- profiles / settings: own row only
create policy own_profile  on public.profiles      for all using (id = auth.uid())      with check (id = auth.uid());
create policy own_settings on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- categories: owner has full control; members can read
create policy categories_owner       on public.categories for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy categories_member_read on public.categories for select
  using (is_category_member(id));

-- category_members: the category owner manages; members can see their own row
create policy members_owner_manage on public.category_members for all
  using (exists (select 1 from public.categories c where c.id = category_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.categories c where c.id = category_id and c.owner_id = auth.uid()));
create policy members_see_own on public.category_members for select
  using (user_id = auth.uid());

-- tasks: owner full; category members read (editors write); direct shares read (editors write)
create policy tasks_owner        on public.tasks for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy tasks_member_read  on public.tasks for select
  using (category_id is not null and is_category_member(category_id));
create policy tasks_member_write on public.tasks for update
  using (category_id is not null and is_category_member(category_id, true));
create policy tasks_shared_read  on public.tasks for select
  using (is_task_shared(id));
create policy tasks_shared_write on public.tasks for update
  using (is_task_shared(id, true));

-- task_shares: task owner manages; user sees their own share
create policy task_shares_owner on public.task_shares for all
  using (exists (select 1 from public.tasks t where t.id = task_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.tasks t where t.id = task_id and t.owner_id = auth.uid()));
create policy task_shares_see_own on public.task_shares for select
  using (user_id = auth.uid());

-- ─────────────────────────── realtime (optional) ───────────────────────────
-- Enable live sync across devices/clients:
-- alter publication supabase_realtime add table public.tasks, public.categories;
