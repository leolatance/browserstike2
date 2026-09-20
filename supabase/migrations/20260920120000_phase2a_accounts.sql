-- Fase 2a: conta, boneco na nuvem. Dexie continua sendo a fonte local; isto é o espelho.
create extension if not exists citext;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nick citext not null unique check (char_length(nick::text) between 3 and 16),
  country text not null default 'BR',
  color text not null default 'yellow' check (color in ('yellow', 'purple', 'green', 'blue', 'orange')),
  photo_url text,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- characters
create table if not exists public.characters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  attrs jsonb not null,
  level int not null default 0 check (level between 0 and 50),
  xp int not null default 0 check (xp >= 0),
  build jsonb not null default '[]'::jsonb,
  dust int not null default 0 check (dust >= 0),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- cards
create table if not exists public.cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  qty int not null default 1 check (qty >= 0),
  level int not null default 1 check (level between 1 and 3),
  primary key (user_id, card_id)
);

-- ----------------------------------------------------------------- matches
-- The log is NOT stored: it is rebuilt from seed + config on the client.
create table if not exists public.matches (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  seed bigint not null,
  config jsonb not null,
  stats jsonb not null,
  rating real not null,
  rewards jsonb not null default '{}'::jsonb,
  mode text not null default 'solo' check (mode in ('solo', 'online')),
  played_at timestamptz not null default now()
);
create index if not exists matches_user_played_idx on public.matches (user_id, played_at desc);

-- ------------------------------------------------------- training_sessions
create table if not exists public.training_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  count int not null default 0 check (count >= 0),
  primary key (user_id, date)
);

-- --------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.cards enable row level security;
alter table public.matches enable row level security;
alter table public.training_sessions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'characters', 'cards', 'matches', 'training_sessions'] loop
    execute format('drop policy if exists "%1$s: own rows" on public.%1$s', t);
    execute format('create policy "%1$s: own rows" on public.%1$s for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ------------------------------------------------------------- public view
-- Nick and public stats for /u/:nick. Definer view: anon can read only these columns.
create or replace view public.public_profiles
with (security_invoker = false) as
with career as (
  select user_id,
         count(*)::int as matches,
         sum(case when (stats->>'kills')::int > 0 or true then 1 else 0 end)::int as played,
         sum((stats->>'kills')::int)::int as kills,
         sum((stats->>'deaths')::int)::int as deaths,
         -- GDD 8.2: last 50 matches weigh 2, the rest 1.
         sum(rating * w) / nullif(sum(w), 0) as career_rating,
         avg(rating) filter (where rn <= 10) as form
  from (
    select user_id, rating, stats,
           row_number() over (partition by user_id order by played_at desc) as rn,
           case when row_number() over (partition by user_id order by played_at desc) <= 50 then 2 else 1 end as w
    from public.matches
  ) s
  group by user_id
)
select p.nick::text as nick, p.country, p.color, p.photo_url, p.created_at,
       c.level, c.build,
       coalesce(k.matches, 0) as matches,
       coalesce(k.kills, 0) as kills,
       coalesce(k.deaths, 0) as deaths,
       k.career_rating,
       k.form
from public.profiles p
join public.characters c on c.user_id = p.user_id
left join career k on k.user_id = p.user_id;

grant select on public.public_profiles to anon, authenticated;
revoke all on public.profiles from anon;
revoke all on public.characters from anon;
revoke all on public.matches from anon;

-- ----------------------------------------------------------------- storage
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars: own path write" on storage.objects;
create policy "avatars: own path write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: own path update" on storage.objects;
create policy "avatars: own path update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: own path delete" on storage.objects;
create policy "avatars: own path delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
