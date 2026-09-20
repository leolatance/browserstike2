/**
 * x1 (GDD v1): a series of pure aim duels on the mid arena, first to `rounds`
 * kills, alternating who initiates. Attributes + build of both sides count; the
 * log uses the match format (one round, `duel`/`kill`/`respawn` events) so the
 * match UI and the minigame replay it unchanged.
 */
import { weapon } from './data/weapons';
import { DUEL, resolveDuel, type DuelContext, type Duelist } from './duel';
import type { MatchEvent, MatchLog, PlayerId, PlayerStats } from './events';
import { areaRange, type MapDef } from './map';
import { effectiveAttrs, resolveBuild, type Player, type Team } from './player';
import { ratingBreakdown } from './rating';
import { Rng } from './rng';

export interface X1Config {
  map: MapDef;
  a: Player;
  b: Player;
}

export const X1 = {
  ROUNDS: 10, // first to 10
  RESPAWN_SECONDS: 3,
  /** Seconds between the respawn and the next contact. */
  SETUP_SECONDS: 2,
};

/** Variant pattern per duel, fixed by the seed: which side holds a fresh angle. */
export type X1Situation = 'timing' | 'premira' | 'alvo';

export interface X1Result {
  log: MatchLog;
  score: [number, number];
  winner: 0 | 1;
  /** Situation of each duel from A's point of view (drives the minigame variant). */
  situations: X1Situation[];
}

export function simulateX1(config: X1Config, seed: number, rounds = X1.ROUNDS): X1Result {
  const rng = new Rng(seed);
  const map = config.map;
  const arena = map.mid.contact;
  const range = areaRange(map, arena);
  const events: MatchEvent[] = [];
  const emit = (e: MatchEvent) => events.push(e);
  const mk = (p: Player, id: PlayerId) => ({ id, p, attrs: effectiveAttrs(p, { mental: p.attrs.mental }), build: resolveBuild(p.build), hp: 100, kills: 0, deaths: 0, damage: 0, headshots: 0, engagements: 0 });
  const A = mk(config.a, 'a1');
  const B = mk(config.b, 'b1');
  const wpn = (side: 0 | 1) => (side === 0 ? 'm4' : 'ak47');
  const money: Record<PlayerId, number> = { a1: 0, b1: 0 };
  emit({ type: 'roundStart', round: 1, t: 0, score: [0, 0], sides: { CT: 0, T: 1 }, money, buy: { CT: 'full', T: 'full' }, pistol: false, freezetimeEnd: 0 });
  for (const l of [A, B]) emit({ type: 'buy', round: 1, t: 0, player: l.id, weapon: wpn(l === A ? 0 : 1), armor: true, helmet: true, kit: false, utils: [], spent: 0 });
  emit({ type: 'respawn', round: 1, t: 0, player: A.id, area: arena });
  emit({ type: 'respawn', round: 1, t: 0, player: B.id, area: arena });

  // Fixed order by seed: each duel is one of timing (A initiates), premira (A holds a fresh angle) or alvo.
  const pattern: X1Situation[] = rng.shuffle(['timing', 'premira', 'alvo'] as X1Situation[]);
  const situations: X1Situation[] = [];
  let t = X1.SETUP_SECONDS;
  let duelN = 0;
  let lastKill = 0;
  while (A.kills < rounds && B.kills < rounds) {
    // Symmetric: the situation belongs to A on even duels and to B on odd ones.
    const owner = duelN % 2 === 0 ? A : B;
    const other = owner === A ? B : A;
    const sit = pattern[Math.floor(duelN / 2) % 3] as X1Situation;
    const attacker = sit === 'timing' ? owner : other;
    const defender = attacker === A ? B : A;
    const holding = sit === 'premira';
    situations.push(A === attacker ? 'timing' : holding ? 'premira' : 'alvo');
    let killed = false;
    let guard = 0;
    while (!killed && guard++ < 10) {
      const id = `r1d${++duelN}`;
      const ctx: DuelContext = {
        range,
        defenderHoldingAngle: holding,
        inSmoke: false,
        retakeProT: null,
        numbersAdvantage: null,
        attackerFlags: { firstDuel: attacker.engagements === 0, pistol: false },
        defenderFlags: { firstDuel: defender.engagements === 0, atSite: holding, pistol: false },
        attrScale: DUEL.ATTR_SCALE_X1,
      };
      emit({
        type: 'duel',
        round: 1,
        t: Math.round(Math.max(0, t - 0.8) * 10) / 10,
        id,
        attacker: attacker.id,
        defender: defender.id,
        area: arena,
        range,
        situation: { holdingAngle: holding, attackerFlashed: false, defenderFlashed: false, inSmoke: false, retakeProT: null, numbers: null, clutch: null },
      });
      attacker.engagements++;
      defender.engagements++;
      const du = (l: typeof A, side: 0 | 1): Duelist => ({ attrs: l.attrs, weapon: weapon(wpn(side)), armor: true, hp: l.hp, clutch: false, conditionals: l.build.conditionals });
      const res = resolveDuel(du(attacker, attacker === A ? 0 : 1), du(defender, defender === A ? 0 : 1), ctx, rng);
      const winner = res.winner === 'A' ? attacker : defender;
      const loser = winner === attacker ? defender : attacker;
      const w = wpn(winner === A ? 0 : 1);
      if (res.loserSurvived) {
        emit({ type: 'damage', round: 1, t, attacker: winner.id, victim: loser.id, amount: res.damage, weapon: w, area: arena, duel: id });
        winner.damage += res.damage;
        loser.hp -= res.damage;
        t += 2;
        continue;
      }
      emit({ type: 'damage', round: 1, t, attacker: winner.id, victim: loser.id, amount: loser.hp, weapon: w, area: arena, duel: id });
      emit({ type: 'kill', round: 1, t, attacker: winner.id, victim: loser.id, weapon: w, headshot: res.headshot, area: arena, duel: id });
      winner.damage += loser.hp;
      winner.kills++;
      if (res.headshot) winner.headshots++;
      loser.deaths++;
      loser.hp = 0;
      lastKill = t;
      killed = true;
      // Both reset for the next duel.
      const next = t + X1.RESPAWN_SECONDS;
      emit({ type: 'respawn', round: 1, t: next, player: loser.id, area: arena });
      A.hp = 100;
      B.hp = 100;
      t = next + X1.SETUP_SECONDS;
    }
  }
  const score: [number, number] = [A.kills, B.kills];
  const winner: 0 | 1 = A.kills >= rounds ? 0 : 1;
  emit({ type: 'roundEnd', round: 1, t: lastKill, winner: winner === 0 ? 'CT' : 'T', winnerTeam: winner, reason: 'elimination', score, survivors: [winner === 0 ? 'a1' : 'b1'] });
  const indexed = events.map((e, i) => ({ e, i }));
  indexed.sort((x, y) => x.e.t - y.e.t || x.i - y.i);
  const stats: PlayerStats[] = [A, B].map((l, i) => {
    const b = ratingBreakdown({ kills: l.kills, deaths: l.deaths, assists: 0, damage: l.damage, kastRounds: 1, rounds: 1 });
    return { id: l.id, team: i as 0 | 1, kills: l.kills, deaths: l.deaths, assists: 0, flashAssists: 0, headshots: l.headshots, damage: l.damage, kastRounds: 1, rounds: 1, entryKills: 0, entryDeaths: 0, multiKills: { 2: 0, 3: 0, 4: 0, 5: 0 }, clutchesWon: 0, clutchAttempts: 0, plants: 0, defuses: 0, rating: b.rating, adr: b.adr, kast: b.kast, cardTriggers: {} };
  });
  const teams: [Team, Team] = [
    { id: 'a', name: config.a.nick, players: [{ ...config.a, id: 'a1' }] },
    { id: 'b', name: config.b.nick, players: [{ ...config.b, id: 'b1' }] },
  ];
  const log: MatchLog = {
    version: 1,
    seed,
    mapId: map.id,
    teams: [
      { id: 'a', name: teams[0].name, players: teams[0].players.map((p) => ({ id: p.id, nick: p.nick, class: p.class })) },
      { id: 'b', name: teams[1].name, players: teams[1].players.map((p) => ({ id: p.id, nick: p.nick, class: p.class })) },
    ],
    startingSides: { CT: 0, T: 1 },
    mr: 1,
    otMr: 0,
    drill: 'x1',
    events: indexed.map((x) => x.e),
    rounds: [{ round: 1, winner: winner === 0 ? 'CT' : 'T', winnerTeam: winner, reason: 'elimination', score, buy: { CT: 'full', T: 'full' }, sides: { CT: 0, T: 1 }, duration: lastKill, planted: false }],
    score,
    winner,
    overtime: false,
    stats,
  };
  return { log, score, winner, situations };
}
