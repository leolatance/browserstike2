-- Online rewards are written by the edge function (service role). A client push
-- (authenticated) must never roll them back: keep the higher level/xp pair.
create or replace function public.characters_guard() returns trigger language plpgsql as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'authenticated' then
    if new.level < old.level or (new.level = old.level and new.xp < old.xp) then
      new.level := old.level;
      new.xp := old.xp;
    end if;
    if new.dust < old.dust then new.dust := old.dust; end if;
  end if;
  return new;
end $$;
drop trigger if exists characters_guard on public.characters;
create trigger characters_guard before update on public.characters
  for each row execute function public.characters_guard();
