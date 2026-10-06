-- Supabase Security Advisor (06/10/2026): RLS on seasons, fixed search_path on
-- functions, refresh_ladders not callable from the API, avatars bucket not
-- listable, citext out of public. The security-definer views and the public
-- materialized ladders are intentional (public read-only aggregates, no PII).

-- seasons: public read, writes only by service role.
alter table public.seasons enable row level security;
drop policy if exists "seasons: public read" on public.seasons;
create policy "seasons: public read" on public.seasons for select to anon, authenticated using (true);

-- citext lives in the extensions schema (Supabase default search_path includes it).
create schema if not exists extensions;
alter extension citext set schema extensions;

-- Functions: pin the search_path (role-mutable search_path warning).
alter function public.current_season_id() set search_path = public, extensions;
alter function public.refresh_ladders() set search_path = public, extensions;
alter function public.characters_guard() set search_path = public, extensions;

-- refresh_ladders runs from pg_cron (postgres role); nobody needs it over /rest/v1/rpc.
revoke execute on function public.refresh_ladders() from public, anon, authenticated;

-- avatars is a public bucket: object URLs work without a SELECT policy. Keep
-- SELECT only on the owner's folder (upsert needs to see the existing object).
drop policy if exists "avatars: public read" on storage.objects;
drop policy if exists "avatars: own path read" on storage.objects;
create policy "avatars: own path read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
