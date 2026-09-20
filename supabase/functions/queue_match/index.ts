/**
 * Edge function `queue_match` (Fase 2b). Body: { attempt?: number }.
 * Builds a 5v5 with real passive characters near the caller's MMR (±150 → 400),
 * fills with bots, simulates on the server, stores online_matches +
 * online_participations, updates MMR / XP / cards, and returns seed + config so
 * the client only replays (never re-simulates for rewards).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyXp, CARDS, RARITY_DROP, Rng, MMR, rankOf } from '../_shared/engine.js';
import { buildLobby, logHash, rangeForAttempt, settle, type QueueUser } from '../_shared/queue.ts';

const RATE_LIMIT_SECONDS = 180;
const MATCH_BOX_CARDS = 2;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function rollCards(rng: Rng, n: number): string[] {
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    let r = rng.next() * 100;
    let tier = 1;
    for (const t of [1, 2, 3, 4, 5]) {
      r -= (RARITY_DROP as Record<number, number>)[t];
      if (r < 0) {
        tier = t;
        break;
      }
    }
    const pool = CARDS.filter((c) => c.rarity === tier);
    out.push(rng.pick(pool.length ? pool : CARDS).id);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth?.user) return json({ error: 'unauthorized' }, 401);
  const uid = auth.user.id;
  const db = createClient(url, service);
  const body = (await req.json().catch(() => ({}))) as { attempt?: number };
  const attempt = Math.max(0, Math.min(10, Number(body.attempt ?? 0)));

  // Rate limit: one online match per 3 minutes.
  const { data: lock } = await db.from('queue_locks').select('last_queue_at').eq('user_id', uid).maybeSingle();
  if (lock && Date.now() - new Date(lock.last_queue_at).getTime() < RATE_LIMIT_SECONDS * 1000) {
    return json({ error: 'rate_limited', retryInSec: Math.ceil((RATE_LIMIT_SECONDS * 1000 - (Date.now() - new Date(lock.last_queue_at).getTime())) / 1000) }, 429);
  }

  const { data: season } = await db.rpc('current_season_id');
  const seasonId = season as number | null;
  if (!seasonId) return json({ error: 'no_season' }, 500);
  const [{ data: profile }, { data: character }, { data: mmrRow }] = await Promise.all([
    db.from('profiles').select('nick, color').eq('user_id', uid).maybeSingle(),
    db.from('characters').select('attrs, build, level, xp').eq('user_id', uid).maybeSingle(),
    db.from('mmr').select('mmr, matches').eq('user_id', uid).eq('season_id', seasonId).maybeSingle(),
  ]);
  if (!profile || !character) return json({ error: 'no_character' }, 400);
  const me: QueueUser = { user_id: uid, nick: profile.nick, attrs: character.attrs, build: character.build ?? [], color: profile.color, level: character.level, mmr: mmrRow?.mmr ?? MMR.START };

  const range = rangeForAttempt(attempt);
  const { data: pool } = await db.rpc('matchmaking_pool', { p_user: uid, p_season: seasonId, p_mmr: me.mmr, p_range: range, p_limit: 9 });
  const candidates = ((pool ?? []) as QueueUser[]).map((u) => ({ ...u, build: u.build ?? [] }));
  if (candidates.length < 9 && range < 400) {
    return json({ status: 'waiting', found: candidates.length, range, nextRange: rangeForAttempt(attempt + 1), retryInSec: 10 });
  }

  const seed = Math.floor(Math.random() * 2 ** 31);
  const lobby = buildLobby(me, candidates, seed);
  const { log, participations } = settle(lobby, uid);
  const mine = participations.find((p) => p.user_id === uid)!;

  const { data: match, error: mErr } = await db
    .from('online_matches')
    .insert({
      season_id: seasonId,
      seed,
      config: { mapId: 'baixada', teams: lobby.teams, startingCT: lobby.startingCT, players: lobby.players.map((p) => ({ id: p.player.id, user_id: p.user_id, mmr: p.mmr })) },
      result: { score: log.score, winner: log.winner, ratings: Object.fromEntries(log.stats.map((s) => [s.id, s.rating])), hash: logHash(log) },
    })
    .select('id')
    .single();
  if (mErr || !match) return json({ error: mErr?.message ?? 'insert_failed' }, 500);

  await db.from('online_participations').insert(participations.map((p) => ({ match_id: match.id, ...p, seen: p.present })));
  await db.from('queue_locks').upsert({ user_id: uid, last_queue_at: new Date().toISOString() });

  // Rewards (server-side only): MMR, XP/level, a 2-card box.
  const newMmr = me.mmr + mine.mmr_delta;
  await db.from('mmr').upsert({ user_id: uid, season_id: seasonId, mmr: newMmr, matches: (mmrRow?.matches ?? 0) + 1, updated_at: new Date().toISOString() });
  const lvl = applyXp({ level: character.level, xp: character.xp }, mine.xp);
  await db.from('characters').update({ level: lvl.level, xp: lvl.xp, updated_at: new Date().toISOString() }).eq('user_id', uid);
  // Passives get a small XP too (GDD 4.4).
  for (const p of participations.filter((x) => !x.present)) {
    const { data: ch } = await db.from('characters').select('level, xp').eq('user_id', p.user_id).maybeSingle();
    if (!ch) continue;
    const l = applyXp({ level: ch.level, xp: ch.xp }, p.xp);
    await db.from('characters').update({ level: l.level, xp: l.xp, updated_at: new Date().toISOString() }).eq('user_id', p.user_id);
  }
  const cards = rollCards(new Rng((seed ^ 0x9e3779b9) >>> 0), MATCH_BOX_CARDS);
  const reveals: { card: string; from: number | null; to: number }[] = [];
  for (const id of cards) {
    const { data: row } = await db.from('cards').select('qty, level').eq('user_id', uid).eq('card_id', id).maybeSingle();
    if (!row) {
      await db.from('cards').insert({ user_id: uid, card_id: id, qty: 1, level: 1 });
      reveals.push({ card: id, from: null, to: 1 });
    } else if (row.level < 3) {
      await db.from('cards').update({ level: row.level + 1 }).eq('user_id', uid).eq('card_id', id);
      reveals.push({ card: id, from: row.level, to: row.level + 1 });
    } else {
      const c = CARDS.find((x) => x.id === id)!;
      const dust = ({ 1: 10, 2: 25, 3: 60, 4: 150, 5: 400 } as Record<number, number>)[c.rarity];
      const { data: ch } = await db.from('characters').select('dust').eq('user_id', uid).single();
      await db.from('characters').update({ dust: (ch?.dust ?? 0) + dust }).eq('user_id', uid);
      reveals.push({ card: id, from: 3, to: 3 });
    }
  }

  return json({
    status: 'ready',
    matchId: match.id,
    seed,
    config: { mapId: 'baixada', teams: lobby.teams, startingCT: lobby.startingCT },
    myId: 'a1',
    myTeam: 0,
    hash: logHash(log),
    result: { score: log.score, winner: log.winner, rating: mine.rating, won: mine.won },
    rewards: { xp: mine.xp, mmrBefore: me.mmr, mmrAfter: newMmr, mmrDelta: mine.mmr_delta, rankBefore: rankOf(me.mmr).name, rankAfter: rankOf(newMmr).name, level: lvl.level, reached: lvl.reached, cards: reveals },
    realPlayers: participations.length,
  });
});
