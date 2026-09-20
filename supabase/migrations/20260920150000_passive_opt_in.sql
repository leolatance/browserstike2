-- Passive characters: opt-in flag, passive box, and ladders that ignore passive matches.
alter table public.profiles add column if not exists available_passive boolean not null default true;
alter table public.online_participations add column if not exists cards jsonb;

create or replace function public.matchmaking_pool(p_user uuid, p_season int, p_mmr int, p_range int, p_limit int)
returns table (user_id uuid, nick text, attrs jsonb, build jsonb, color text, level int, mmr int)
language sql security definer set search_path = public as $$
  select c.user_id, p.nick::text, c.attrs, c.build, p.color, c.level, coalesce(m.mmr, 1000)
  from characters c
  join profiles p on p.user_id = c.user_id
  left join mmr m on m.user_id = c.user_id and m.season_id = p_season
  where c.user_id <> p_user
    and p.available_passive
    and abs(coalesce(m.mmr, 1000) - p_mmr) <= p_range
  order by abs(coalesce(m.mmr, 1000) - p_mmr), random()
  limit p_limit
$$;

-- Rating ladder counts only matches the owner was present for (GDD 8.2 v1).
drop materialized view if exists public.ladder_rating cascade;
create materialized view public.ladder_rating as
with per as (
  select op.user_id, om.season_id,
         avg(op.rating) as rating,
         count(*) as matches,
         avg((select avg(coalesce(mm.mmr, 1000)) from public.online_participations o2
              left join public.mmr mm on mm.user_id = o2.user_id and mm.season_id = om.season_id
              where o2.match_id = op.match_id and o2.team <> op.team)) as opp_mmr
  from public.online_participations op
  join public.online_matches om on om.id = op.match_id
  where op.present
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
grant select on public.ladder_rating to anon, authenticated;

-- public_profiles_v2 depended on the old view: recreate.
create or replace view public.public_profiles_v2 with (security_invoker = false) as
select pp.*, exists (select 1 from public.ladder_rating l where l.nick = pp.nick and l.season_id = public.current_season_id() and l.pos <= 100) as top100
from public.public_profiles pp;
grant select on public.public_profiles_v2 to anon, authenticated;
