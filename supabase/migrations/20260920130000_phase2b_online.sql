-- Fase 2b: queue online assíncrona, MMR/patente, temporadas, rankings.
create extension if not exists pg_cron;

-- ----------------------------------------------------------------- seasons
create table if not exists public.seasons (
  id int generated always as identity primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  name text not null
);
create unique index if not exists seasons_active_idx on public.seasons (starts_at);
insert into public.seasons (starts_at, ends_at, name)
select date_trunc('day', now()), date_trunc('day', now()) + interval '30 days', 'Temporada 1'
where not exists (select 1 from public.seasons);

create or replace function public.current_season_id() returns int language sql stable as $$
  select id from public.seasons where now() >= starts_at and now() < ends_at order by starts_at desc limit 1
$$;

-- --------------------------------------------------------------------- MMR
-- GDD 8.3: Elo K=25, 10 tiers, soft reset per season. One row per user per season.
create table if not exists public.mmr (
  user_id uuid not null references auth.users (id) on delete cascade,
  season_id int not null references public.seasons (id) on delete cascade,
  mmr int not null default 1000,
  matches int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, season_id)
);

-- ---------------------------------------------------------- online matches
create table if not exists public.online_matches (
  id bigint generated always as identity primary key,
  season_id int not null references public.seasons (id),
  seed bigint not null,
  config jsonb not null,           -- the 10 characters (attrs + builds), map, startingCT
  result jsonb not null,           -- score, winner, per-player rating
  played_at timestamptz not null default now()
);

create table if not exists public.online_participations (
  id bigint generated always as identity primary key,
  match_id bigint not null references public.online_matches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  present boolean not null,
  team smallint not null check (team in (0, 1)),
  player_id text not null,
  rating real not null,
  mmr_delta int not null default 0,
  xp int not null default 0,
  won boolean not null,
  seen boolean not null default false,
  played_at timestamptz not null default now(),
  unique (match_id, user_id)
);
create index if not exists participations_user_idx on public.online_participations (user_id, played_at desc);

-- Rate limit bookkeeping: last queue per user.
create table if not exists public.queue_locks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_queue_at timestamptz not null default now()
);

alter table public.mmr enable row level security;
alter table public.online_matches enable row level security;
alter table public.online_participations enable row level security;
alter table public.queue_locks enable row level security;

drop policy if exists "mmr: read own" on public.mmr;
create policy "mmr: read own" on public.mmr for select to authenticated using (auth.uid() = user_id);
drop policy if exists "online_matches: participants read" on public.online_matches;
create policy "online_matches: participants read" on public.online_matches for select to authenticated
  using (exists (select 1 from public.online_participations p where p.match_id = id and p.user_id = auth.uid()));
drop policy if exists "participations: read own" on public.online_participations;
create policy "participations: read own" on public.online_participations for select to authenticated using (auth.uid() = user_id);
drop policy if exists "participations: mark seen" on public.online_participations;
create policy "participations: mark seen" on public.online_participations for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Writes happen only from the edge function (service role bypasses RLS).

-- ------------------------------------------------------------ matchmaking
-- Candidates for a lobby: other users with a character, by MMR distance. Service role only.
create or replace function public.matchmaking_pool(p_user uuid, p_season int, p_mmr int, p_range int, p_limit int)
returns table (user_id uuid, nick text, attrs jsonb, build jsonb, color text, level int, mmr int)
language sql security definer set search_path = public as $$
  select c.user_id, p.nick::text, c.attrs, c.build, p.color, c.level, coalesce(m.mmr, 1000)
  from characters c
  join profiles p on p.user_id = c.user_id
  left join mmr m on m.user_id = c.user_id and m.season_id = p_season
  where c.user_id <> p_user
    and abs(coalesce(m.mmr, 1000) - p_mmr) <= p_range
  order by abs(coalesce(m.mmr, 1000) - p_mmr), random()
  limit p_limit
$$;
revoke all on function public.matchmaking_pool(uuid, int, int, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------- ladders
create materialized view if not exists public.ladder_mmr as
select m.season_id, p.nick::text as nick, p.color, p.photo_url, m.mmr, m.matches,
       rank() over (partition by m.season_id order by m.mmr desc, m.matches desc) as pos
from public.mmr m join public.profiles p on p.user_id = m.user_id
where m.matches > 0;
create unique index if not exists ladder_mmr_idx on public.ladder_mmr (season_id, nick);

-- Rating ladder: by season, with the rank tier, and a global rating normalised by the
-- average MMR of the opponents faced (harder lobbies count more).
create materialized view if not exists public.ladder_rating as
with per as (
  select op.user_id, om.season_id,
         avg(op.rating * (case when op.present then 1 else 0.5 end)) / avg(case when op.present then 1 else 0.5 end) as rating,
         count(*) as matches,
         avg((select avg(coalesce(mm.mmr, 1000)) from public.online_participations o2
              left join public.mmr mm on mm.user_id = o2.user_id and mm.season_id = om.season_id
              where o2.match_id = op.match_id and o2.team <> op.team)) as opp_mmr
  from public.online_participations op
  join public.online_matches om on om.id = op.match_id
  group by op.user_id, om.season_id
)
select per.season_id, p.nick::text as nick, p.color, p.photo_url,
       per.rating::real as rating, per.matches::int as matches,
       (per.rating * (per.opp_mmr / 1000.0))::real as rating_global,
       coalesce(m.mmr, 1000) as mmr,
       rank() over (partition by per.season_id order by per.rating desc) as pos,
       rank() over (partition by per.season_id order by per.rating * (per.opp_mmr / 1000.0) desc) as pos_global
from per
join public.profiles p on p.user_id = per.user_id
left join public.mmr m on m.user_id = per.user_id and m.season_id = per.season_id
where per.matches >= 3;
create unique index if not exists ladder_rating_idx on public.ladder_rating (season_id, nick);

grant select on public.ladder_mmr, public.ladder_rating to anon, authenticated;

create or replace function public.refresh_ladders() returns void language plpgsql security definer as $$
begin
  refresh materialized view concurrently public.ladder_mmr;
  refresh materialized view concurrently public.ladder_rating;
end $$;

-- Every 5 minutes (pg_cron). Idempotent scheduling.
select cron.unschedule(jobid) from cron.job where jobname = 'refresh_ladders';
select cron.schedule('refresh_ladders', '*/5 * * * *', 'select public.refresh_ladders()');

-- Top 100 rating badge for /u/:nick.
create or replace view public.public_profiles_v2 with (security_invoker = false) as
select pp.*, exists (select 1 from public.ladder_rating l where l.nick = pp.nick and l.season_id = public.current_season_id() and l.pos <= 100) as top100
from public.public_profiles pp;
grant select on public.public_profiles_v2 to anon, authenticated;
