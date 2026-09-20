-- x1 invites carry the host nick so the lobby can show "fulano te chamou" without a join.
alter table public.x1_invites add column if not exists host_nick text;
