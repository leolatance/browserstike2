import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { START_DELAY_MS, inviteCode, x1Config, x1Delta, x1Expected } from '../_shared/x1.ts';

Deno.test('Elo K=30 without damping, symmetric', () => {
  assertEquals(x1Expected(1000, 1000), 0.5);
  const d = x1Delta(1000, 1000);
  assertEquals(d.winner, 15);
  assertEquals(d.loser, -15);
  const up = x1Delta(1200, 1000);
  assert(up.winner < 15 && up.winner > 0);
  const upset = x1Delta(1000, 1200);
  assert(upset.winner > 15);
});

Deno.test('invite codes are 6 chars from the unambiguous alphabet; config carries both players', () => {
  let i = 0;
  const code = inviteCode(() => ((i += 0.37) % 1), 6);
  assertEquals(code.length, 6);
  assert(!/[01IO]/.test(code));
  const host = { user_id: 'h', nick: 'host', color: 'yellow', attrs: { mira: 30 }, build: [] };
  const guest = { user_id: 'g', nick: 'guest', color: 'blue', attrs: { mira: 28 }, build: [{ id: 'card_aim_crosshair', level: 1 }] };
  const cfg = x1Config(host, guest);
  assertEquals(cfg.host.player.id, 'a1');
  assertEquals(cfg.guest.player.id, 'b1');
  assertEquals(cfg.guest.player.build.cards.length, 1);
  assertEquals(START_DELAY_MS, 3000);
});
