-- =========================================================================
-- connected_accounts
-- =========================================================================
create table public.connected_accounts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  provider           text not null check (provider in ('faceit')),
  provider_user_id   text not null,
  nickname           text,
  connected_at       timestamptz not null default now(),
  last_synced_at     timestamptz,
  needs_reauth       boolean not null default false,
  unique (provider, provider_user_id)
);

grant select, delete on public.connected_accounts to authenticated;
grant all           on public.connected_accounts to service_role;

alter table public.connected_accounts enable row level security;

create policy "connected_accounts: owner reads own"
  on public.connected_accounts for select to authenticated
  using (user_id = (select auth.uid()));

create policy "connected_accounts: owner deletes own"
  on public.connected_accounts for delete to authenticated
  using (user_id = (select auth.uid()));

-- =========================================================================
-- connected_account_secrets  (tokens criptografados; ZERO policies)
-- =========================================================================
create table public.connected_account_secrets (
  account_id                uuid primary key references public.connected_accounts(id) on delete cascade,
  access_token_ct           bytea not null,
  access_token_iv           bytea not null,
  refresh_token_ct          bytea,
  refresh_token_iv          bytea,
  access_token_expires_at   timestamptz,
  updated_at                timestamptz not null default now()
);

revoke all on public.connected_account_secrets from public;
revoke all on public.connected_account_secrets from anon;
revoke all on public.connected_account_secrets from authenticated;
grant all  on public.connected_account_secrets to service_role;

alter table public.connected_account_secrets enable row level security;
-- Intencional: nenhuma policy. Só service_role bypassa RLS.

-- =========================================================================
-- oauth_states  (PKCE state; service_role only)
-- =========================================================================
create table public.oauth_states (
  state           text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null check (provider in ('faceit')),
  code_verifier   text not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '10 minutes')
);

revoke all on public.oauth_states from public;
revoke all on public.oauth_states from anon;
revoke all on public.oauth_states from authenticated;
grant all  on public.oauth_states to service_role;

alter table public.oauth_states enable row level security;
-- Sem policies.

-- =========================================================================
-- sync_jobs — adiciona check de provider + unique parcial (um job ativo)
-- =========================================================================
alter table public.sync_jobs
  drop constraint if exists sync_jobs_provider_check;
alter table public.sync_jobs
  add constraint sync_jobs_provider_check check (provider in ('faceit'));

alter table public.sync_jobs
  drop constraint if exists sync_jobs_status_check;
alter table public.sync_jobs
  add constraint sync_jobs_status_check check (status in ('pending','running','success','error'));

create unique index if not exists sync_jobs_one_active
  on public.sync_jobs (user_id, provider)
  where status in ('pending','running');

-- =========================================================================
-- matches
-- =========================================================================
create table public.matches (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  provider           text not null check (provider in ('faceit')),
  match_id           text not null,
  game               text not null,
  map                text,
  competition_type   text,
  played_at          timestamptz not null,
  duration_seconds   integer,
  rounds_won         integer,
  rounds_lost        integer,
  result             text not null check (result in ('win','loss','draw')),
  raw                jsonb not null,
  created_at         timestamptz not null default now(),
  unique (user_id, provider, match_id)
);

grant select, insert, update, delete on public.matches to authenticated;
grant select                          on public.matches to anon;
grant all                             on public.matches to service_role;

alter table public.matches enable row level security;

create policy "matches: owner or public profile reads"
  on public.matches for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or public.is_profile_public(user_id)
  );

create policy "matches: service_role writes"
  on public.matches for all to service_role
  using (true) with check (true);

create index matches_user_played_at_idx
  on public.matches (user_id, played_at desc);

-- =========================================================================
-- match_stats
-- =========================================================================
create table public.match_stats (
  match_id         text primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  kills            integer not null default 0,
  deaths           integer not null default 0,
  assists          integer not null default 0,
  mvps             integer not null default 0,
  rounds           integer not null default 0,
  headshots        integer not null default 0,
  headshot_pct     numeric not null default 0,
  kd_ratio         numeric not null default 0,
  kr_ratio         numeric not null default 0,
  adr              numeric not null default 0,
  rating_approx    numeric not null default 0,
  won              boolean not null default false,
  created_at       timestamptz not null default now()
);

grant select, insert, update, delete on public.match_stats to authenticated;
grant select                          on public.match_stats to anon;
grant all                             on public.match_stats to service_role;

alter table public.match_stats enable row level security;

create policy "match_stats: owner or public profile reads"
  on public.match_stats for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or public.is_profile_public(user_id)
  );

create policy "match_stats: service_role writes"
  on public.match_stats for all to service_role
  using (true) with check (true);

create index match_stats_user_idx on public.match_stats (user_id);

-- =========================================================================
-- index_snapshots
-- =========================================================================
create table public.index_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  total_score           numeric not null,
  performance_score     numeric not null,
  consistency_score     numeric not null,
  evolution_score       numeric not null,
  participation_score   numeric not null,
  matches_considered    integer not null,
  is_calibrating        boolean not null,
  breakdown             jsonb not null,
  computed_at           timestamptz not null default now()
);

grant select on public.index_snapshots to authenticated;
grant select on public.index_snapshots to anon;
grant all    on public.index_snapshots to service_role;

alter table public.index_snapshots enable row level security;

create policy "index_snapshots: owner or public profile reads"
  on public.index_snapshots for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or public.is_profile_public(user_id)
  );

create policy "index_snapshots: service_role writes"
  on public.index_snapshots for all to service_role
  using (true) with check (true);

create index index_snapshots_user_computed_at_idx
  on public.index_snapshots (user_id, computed_at desc);