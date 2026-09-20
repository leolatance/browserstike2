-- x1 online: invites, matches, Elo ladder (K=30, no damping), "Rei do x1" badge.
create table if not exists public.x1_invites (
  code text primary key,
  host_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('build', 'mira')),
  target_nick citext,
  created_at timestamptz not null default now(),
  accepted_by uuid references auth.users (id) on delete set null,
  match_id bigint
);
create index if not exists x1_invites_target_idx on public.x1_invites (target_nick, created_at desc);

create table if not exists public.x1_matches (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('build', 'mira')),
  host_id uuid not null references auth.users (id) on delete cascade,
  guest_id uuid not null references auth.users (id) on delete cascade,
  seed bigint not null,
  config jsonb not null,           -- both players (attrs + build + nick + color)
  status text not null default 'ready' check (status in ('ready', 'done', 'wo')),
  start_at timestamptz not null,
  result jsonb,                    -- { score: [host, guest], winner: 'host'|'guest', reason }
  created_at timestamptz not null default now()
);
create index if not exists x1_matches_users_idx on public.x1_matches (host_id, guest_id, created_at desc);

create table if not exists public.x1_ratings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  elo int not null default 1000,
  matches int not null default 0,
  wins int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.x1_invites enable row level security;
alter table public.x1_matches enable row level security;
alter table public.x1_ratings enable row level security;
drop policy if exists "x1_invites: host or target" on public.x1_invites;
create policy "x1_invites: host or target" on public.x1_invites for select to authenticated
  using (host_id = auth.uid() or target_nick = (select nick from public.profiles where user_id = auth.uid()));
drop policy if exists "x1_matches: participants" on public.x1_matches;
create policy "x1_matches: participants" on public.x1_matches for select to authenticated
  using (host_id = auth.uid() or guest_id = auth.uid());
drop policy if exists "x1_ratings: read own" on public.x1_ratings;
create policy "x1_ratings: read own" on public.x1_ratings for select to authenticated using (user_id = auth.uid());
-- Writes: edge function only (service role).

create or replace view public.ladder_x1 with (security_invoker = false) as
select p.nick::text as nick, p.color, p.photo_url, r.elo, r.matches, r.wins,
       rank() over (order by r.elo desc, r.wins desc) as pos
from public.x1_ratings r join public.profiles p on p.user_id = r.user_id
where r.matches > 0
order by pos
limit 100;
grant select on public.ladder_x1 to anon, authenticated;

create or replace view public.public_profiles_v2 with (security_invoker = false) as
select pp.*,
       exists (select 1 from public.ladder_rating l where l.nick = pp.nick and l.season_id = public.current_season_id() and l.pos <= 100) as top100,
       exists (select 1 from public.ladder_x1 x where x.nick = pp.nick and x.pos = 1) as rei_x1
from public.public_profiles pp;
grant select on public.public_profiles_v2 to anon, authenticated;
