
-- profiles
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null unique,
  display_name  text,
  avatar_url    text,
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant select                          on public.profiles to anon;
grant all                             on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "profiles: owner reads own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: public reads is_public"
  on public.profiles for select to anon, authenticated
  using (is_public = true);

create policy "profiles: owner updates own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles: owner inserts own"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

-- updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- handle_new_user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  base_username text;
  candidate     text;
  suffix        int := 0;
begin
  base_username := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'preferred_username', ''),
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );
  -- sanitize (letras, números, _.-)
  base_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_.-]', '', 'g'));
  if length(base_username) < 3 then
    base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  candidate := base_username;
  while exists(select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- is_profile_public helper (canonical for future public tables)
create or replace function public.is_profile_public(p_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select is_public from public.profiles where id = p_id), false)
$$;

revoke execute on function public.is_profile_public(uuid) from public;
grant  execute on function public.is_profile_public(uuid) to anon, authenticated;

-- sync_jobs
create table public.sync_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null check (provider in ('faceit')),
  status          text not null check (status in ('pending','running','success','error')),
  matches_synced  integer not null default 0,
  error           text,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);

grant select on public.sync_jobs to authenticated;
grant all    on public.sync_jobs to service_role;

alter table public.sync_jobs enable row level security;

create policy "sync_jobs: owner reads own"
  on public.sync_jobs for select to authenticated
  using (user_id = (select auth.uid()));

create unique index sync_jobs_one_active
  on public.sync_jobs (user_id, provider)
  where status in ('pending','running');

create index sync_jobs_user_created_idx
  on public.sync_jobs (user_id, created_at desc);
