/**
 * Local tests for the queue: two fake users, bots fill the rest, rewards and
 * client/server determinism (hash written by the vitest side).
 *   npx deno test --allow-read supabase/functions/queue_match/queue_test.ts
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { MAP01, simulateMatch } from '../_shared/engine.js';
import { buildLobby, logHash, rangeForAttempt, settle, type MatchLog, type QueueUser } from '../_shared/queue.ts';

const attrs = (v: number) => ({ mira: v, mov: v, peek: v, tatico: v, util: v, mental: v });
const alice: QueueUser = { user_id: 'u-alice', nick: 'alice', attrs: attrs(40), build: [], level: 5, mmr: 1050 };
const bob: QueueUser = { user_id: 'u-bob', nick: 'bob', attrs: attrs(38), build: [{ id: 'card_aim_crosshair', level: 1 }], level: 4, mmr: 980 };

Deno.test('lobby: queuing user is a1 on team 0, the other real user lands on the other team, bots fill', () => {
  const lobby = buildLobby(alice, [bob], 42);
  assertEquals(lobby.teams[0].players[0].id, 'a1');
  assertEquals(lobby.teams[0].players[0].nick, 'alice');
  assertEquals(lobby.teams[0].players.length, 5);
  assertEquals(lobby.teams[1].players.length, 5);
  const bobEntry = lobby.players.find((p) => p.user_id === 'u-bob')!;
  assertEquals(bobEntry.team, 1);
  assertEquals(lobby.players.filter((p) => p.user_id === null).length, 8);
});

Deno.test('range widens 150 → 400', () => {
  assertEquals(rangeForAttempt(0), 150);
  assertEquals(rangeForAttempt(3), 300);
  assertEquals(rangeForAttempt(9), 400);
});

Deno.test('settle: present user moves MMR and earns online XP; passive keeps MMR', () => {
  const lobby = buildLobby(alice, [bob], 7);
  const { log, participations } = settle(lobby, 'u-alice');
  assertEquals(participations.length, 2);
  const a = participations.find((p) => p.user_id === 'u-alice')!;
  const b = participations.find((p) => p.user_id === 'u-bob')!;
  void b;
  assert(a.present && !b.present);
  assertEquals(b.mmr_delta, 0);
  assert(a.mmr_delta !== 0);
  assert(a.xp > 0 && b.xp > 0 && b.xp < a.xp);
  assertEquals(a.won, log.winner === 0);
  // Same seed + config → same log, on this side too.
  const again = simulateMatch({ map: MAP01, teams: lobby.teams, startingCT: lobby.startingCT }, lobby.seed);
  assertEquals(logHash(again), logHash(log));
});

Deno.test('client/server determinism: hash matches the fixture produced by vitest', async () => {
  const fixture = JSON.parse(await Deno.readTextFile(new URL('../../../packages/engine/test/fixtures/determinism.json', import.meta.url)));
  const log = simulateMatch({ map: MAP01, teams: fixture.config.teams, startingCT: fixture.config.startingCT }, fixture.seed);
  assertEquals(logHash(log), fixture.hash);
});
