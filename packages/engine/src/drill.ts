/**
 * Drill modes (GDD 4.1 / 4.2 v1): Deathmatch and short training scenarios.
 * Same rules as a match — deterministic, event log, `duel` events for the
 * minigame — but no economy and no bomb. Output is a one-round MatchLog so the
 * match UI (radar, feed, minigame) replays it unchanged.
 */
import { generateBotTeam } from './bots';
import { weapon } from './data/weapons';
import { resolveDuel, type DuelContext, type Duelist } from './duel';
import type { AreaId, MatchEvent, MatchLog, PlayerId, PlayerStats, Side } from './events';
import { areaRange, shortestPath, type MapDef } from './map';
import { effectiveAttrs, resolveBuild, type Attrs, type Player, type PlayerClass, type ResolvedBuild, type Team } from './player';
import { ratingBreakdown } from './rating';
import { Rng } from './rng';

export const DRILL = {
  RESPAWN_SECONDS: 3, // [v1]
  /** DM: chance a free player hunts the nearest enemy instead of wandering. */
  HUNT: 0.75, // [v1]
  /** DM: extra retreat chance so fights disengage (keeps kills at ~1/3 of duels). */
  DM_RETREAT_BONUS: 0.35, // [v1]
  DM_COOLDOWN: 2, // [v1] seconds after a duel before the next engagement
  DUEL_GAP_MIN: 2, // [v1]
  DUEL_GAP_MAX: 5, // [v1]
  CHIP_CHANCE: 0.2, // [v1]
};

export type ScenarioKind = 'aim1v1' | 'peek' | 'rush' | 'retake2v2' | 'retake3v2' | 'execute';
export type RetakeCall = 'padrao' | 'flanco' | 'agressivo';
export const RETAKE_CALLS: RetakeCall[] = ['padrao', 'flanco', 'agressivo'];

export interface DrillConfig {
  map: MapDef;
  /** The user's character (id kept as given; team 0). */
  me: Player;
  /** Bot level (average attribute). */
  botAvg: number;
}

export interface ScenarioResult {
  kind: ScenarioKind;
  title: string;
  won: boolean;
  /** Duels the character took part in / won. */
  duels: number;
  duelsWon: number;
  /** Game seconds until the scenario resolved. */
  timeSec: number;
  /** Retake scenarios: the call used, and the one the hidden setup rewarded. */
  call?: RetakeCall;
  correctCall?: RetakeCall;
  log: MatchLog;
}

export const SCENARIO_TITLE: Record<ScenarioKind, string> = {
  aim1v1: 'Aim 1v1',
  peek: 'Peek no ângulo',
  rush: 'Rush 3v2',
  retake2v2: 'Retake B 2v2',
  retake3v2: 'Retake A 3v2',
  execute: 'Execute A 3v2',
};

// ---------------------------------------------------------------------------
// Shared arena machinery
// ---------------------------------------------------------------------------

interface Live {
  id: PlayerId;
  base: Player;
  side: Side;
  team: 0 | 1;
  attrs: Attrs;
  build: ResolvedBuild;
  speed: number;
  hp: number;
  alive: boolean;
  area: AreaId;
  /** Free to act at/after this time. */
  busyUntil: number;
  /** Time the player settled in the current area (fresh angle after 2s). */
  settledAt: number;
  respawnAt: number;
  engagements: number;
  kills: number;
  deaths: number;
  damage: number;
  headshots: number;
  assists: number;
  cardTriggers: Record<string, number>;
  /** Scenario role. */
  attacker: boolean;
}

function mkLive(p: Player, side: Side, team: 0 | 1, area: AreaId, attacker: boolean): Live {
  const attrs = effectiveAttrs(p, { mental: p.attrs.mental });
  return {
    id: p.id,
    base: { ...p, build: p.build },
    side,
    team,
    attrs,
    build: resolveBuild(p.build),
    speed: 1.1 - 0.2 * (attrs.mov / 100),
    hp: 100,
    alive: true,
    area,
    busyUntil: 0,
    settledAt: 0,
    respawnAt: -1,
    engagements: 0,
    kills: 0,
    deaths: 0,
    damage: 0,
    headshots: 0,
    assists: 0,
    cardTriggers: {},
    attacker,
  };
}

interface Arena {
  map: MapDef;
  rng: Rng;
  events: MatchEvent[];
  players: Live[];
  duelCounter: number;
  lastKillT: number;
  retreatBonus: number;
  weaponOf: (l: Live) => string;
}

function emit(a: Arena, e: MatchEvent): void {
  a.events.push(e);
}

/** Emit move events along the shortest path; returns the arrival time. */
function walk(a: Arena, l: Live, to: AreaId, startT: number): number {
  const path = shortestPath(a.map, l.area, to);
  if (!path || path.path.length < 2) return startT;
  let t = startT;
  for (let i = 0; i < path.path.length - 1; i++) {
    const from = path.path[i] as AreaId;
    const next = path.path[i + 1] as AreaId;
    const leg = shortestPath(a.map, from, next)!.time;
    const duration = Math.max(1, Math.round(leg * l.speed));
    emit(a, { type: 'move', round: 1, t: Math.round(t), player: l.id, from, to: next, duration });
    t += duration;
  }
  l.area = to;
  l.settledAt = Math.round(t);
  return Math.round(t);
}

function duelist(l: Live, weaponId: string, clutch: boolean): Duelist {
  return { attrs: l.attrs, weapon: weapon(weaponId), armor: true, hp: l.hp, clutch, conditionals: l.build.conditionals, siteSurvival: l.build.siteSurvival };
}

interface FightOpts {
  area: AreaId;
  defenderHoldingAngle: boolean;
  retakeProT: 'A' | 'D' | null;
  /** Where a retreating attacker / defender falls back to. */
  fallbackA: AreaId;
  fallbackD: AreaId;
  aliveA: number;
  aliveD: number;
}

/** One duel with chip damage and trade-free resolution. Returns the winner and the loser if killed. */
function fight(a: Arena, at: Live, df: Live, t: number, o: FightOpts): { winner: Live; killed: Live | null } {
  const flagsA = { firstDuel: at.engagements === 0, pistol: false };
  const flagsD = { firstDuel: df.engagements === 0, atSite: o.defenderHoldingAngle, pistol: false };
  at.engagements++;
  df.engagements++;
  const clutchA = o.aliveA === 1 && o.aliveD >= 2;
  const clutchD = o.aliveD === 1 && o.aliveA >= 2;
  const ctx: DuelContext = {
    range: areaRange(a.map, o.area),
    defenderHoldingAngle: o.defenderHoldingAngle,
    inSmoke: false,
    retakeProT: o.retakeProT,
    numbersAdvantage: o.aliveA > o.aliveD ? 'A' : o.aliveD > o.aliveA ? 'D' : null,
    attackerFlags: flagsA,
    defenderFlags: flagsD,
    retreatBonus: a.retreatBonus,
  };
  const id = `r1d${++a.duelCounter}`;
  emit(a, {
    type: 'duel',
    round: 1,
    t: Math.round(Math.max(0, t - 0.8) * 10) / 10,
    id,
    attacker: at.id,
    defender: df.id,
    area: o.area,
    range: ctx.range,
    situation: {
      holdingAngle: ctx.defenderHoldingAngle,
      attackerFlashed: false,
      defenderFlashed: false,
      inSmoke: false,
      retakeProT: ctx.retakeProT,
      numbers: ctx.numbersAdvantage,
      clutch: clutchA ? 'A' : clutchD ? 'D' : null,
    },
  });
  const res = resolveDuel(duelist(at, a.weaponOf(at), clutchA), duelist(df, a.weaponOf(df), clutchD), ctx, a.rng);
  const winner = res.winner === 'A' ? at : df;
  const loser = res.winner === 'A' ? df : at;
  const last = a.events[a.events.length - 1];
  if (last && last.type === 'duel' && (res.triggered.A.length || res.triggered.D.length)) {
    last.triggered = {};
    if (res.triggered.A.length) last.triggered[at.id] = res.triggered.A;
    if (res.triggered.D.length) last.triggered[df.id] = res.triggered.D;
  }
  for (const s of res.triggered.A) at.cardTriggers[s] = (at.cardTriggers[s] ?? 0) + 1;
  for (const s of res.triggered.D) df.cardTriggers[s] = (df.cardTriggers[s] ?? 0) + 1;

  if (winner.hp > 1 && a.rng.chance(DRILL.CHIP_CHANCE)) {
    const chip = Math.min(winner.hp - 1, a.rng.int(10, 60));
    emit(a, { type: 'damage', round: 1, t, attacker: loser.id, victim: winner.id, amount: chip, weapon: a.weaponOf(loser), area: o.area, duel: id });
    winner.hp -= chip;
    loser.damage += chip;
  }
  const w = a.weaponOf(winner);
  if (res.loserSurvived) {
    emit(a, { type: 'damage', round: 1, t, attacker: winner.id, victim: loser.id, amount: res.damage, weapon: w, area: o.area, duel: id });
    winner.damage += res.damage;
    loser.hp -= res.damage;
    const fallback = loser === at ? o.fallbackA : o.fallbackD;
    loser.busyUntil = walk(a, loser, fallback, t) + 1;
    return { winner, killed: null };
  }
  emit(a, { type: 'damage', round: 1, t, attacker: winner.id, victim: loser.id, amount: loser.hp, weapon: w, area: o.area, duel: id });
  winner.damage += loser.hp;
  const headshot = res.headshot;
  emit(a, { type: 'kill', round: 1, t, attacker: winner.id, victim: loser.id, weapon: w, headshot, area: o.area, duel: id });
  loser.alive = false;
  loser.hp = 0;
  loser.deaths++;
  winner.kills++;
  if (headshot) winner.headshots++;
  a.lastKillT = t;
  return { winner, killed: loser };
}

function finishLog(a: Arena, drill: string, seed: number, teams: [Team, Team], endT: number, winnerTeam: 0 | 1, reason: 'elimination' | 'time'): MatchLog {
  const survivors = a.players.filter((l) => l.alive).map((l) => l.id);
  emit(a, { type: 'roundEnd', round: 1, t: endT, winner: winnerTeam === 0 ? 'CT' : 'T', winnerTeam, reason, score: winnerTeam === 0 ? [1, 0] : [0, 1], survivors });
  const indexed = a.events.filter((e) => !(e.type === 'move' && e.t > endT)).map((e, i) => ({ e: e.t > endT ? { ...e, t: endT } : e, i }));
  indexed.sort((x, y) => x.e.t - y.e.t || x.i - y.i);
  const stats: PlayerStats[] = a.players.map((l) => {
    const b = ratingBreakdown({ kills: l.kills, deaths: l.deaths, assists: 0, damage: l.damage, kastRounds: l.kills > 0 || l.alive ? 1 : 0, rounds: 1 });
    return {
      id: l.id,
      team: l.team,
      kills: l.kills,
      deaths: l.deaths,
      assists: 0,
      flashAssists: 0,
      headshots: l.headshots,
      damage: l.damage,
      kastRounds: l.kills > 0 || l.alive ? 1 : 0,
      rounds: 1,
      entryKills: 0,
      entryDeaths: 0,
      multiKills: { 2: 0, 3: 0, 4: 0, 5: 0 },
      clutchesWon: 0,
      clutchAttempts: 0,
      plants: 0,
      defuses: 0,
      rating: b.rating,
      adr: b.adr,
      kast: b.kast,
      cardTriggers: l.cardTriggers,
    };
  });
  return {
    version: 1,
    seed,
    mapId: a.map.id,
    teams: [logTeam(teams[0]), logTeam(teams[1])],
    startingSides: { CT: 0, T: 1 },
    mr: 1,
    otMr: 0,
    drill,
    events: indexed.map((x) => x.e),
    rounds: [{ round: 1, winner: winnerTeam === 0 ? 'CT' : 'T', winnerTeam, reason, score: winnerTeam === 0 ? [1, 0] : [0, 1], buy: { CT: 'full', T: 'full' }, sides: { CT: 0, T: 1 }, duration: endT, planted: false }],
    score: winnerTeam === 0 ? [1, 0] : [0, 1],
    winner: winnerTeam,
    overtime: false,
    stats,
  };
}

function logTeam(team: Team) {
  return { id: team.id, name: team.name, players: team.players.map((p) => ({ id: p.id, nick: p.nick, class: p.class })) };
}

function roundStart(a: Arena, players: Live[]): void {
  const money: Record<PlayerId, number> = {};
  for (const l of players) money[l.id] = 0;
  emit(a, { type: 'roundStart', round: 1, t: 0, score: [0, 0], sides: { CT: 0, T: 1 }, money, buy: { CT: 'full', T: 'full' }, pistol: false, freezetimeEnd: 0 });
  for (const l of players) emit(a, { type: 'buy', round: 1, t: 0, player: l.id, weapon: a.weaponOf(l), armor: true, helmet: true, kit: false, utils: [], spent: 0 });
}

// ---------------------------------------------------------------------------
// Deathmatch
// ---------------------------------------------------------------------------

export interface DeathmatchConfig {
  map: MapDef;
  teams: [Team, Team];
}

/** Team deathmatch on the whole map: respawns, no economy, no bomb. */
export function simulateDeathmatch(config: DeathmatchConfig, seed: number, durationSec: number): MatchLog {
  const rng = new Rng(seed);
  const map = config.map;
  const a: Arena = { map, rng, events: [], players: [], duelCounter: 0, lastKillT: 0, retreatBonus: DRILL.DM_RETREAT_BONUS, weaponOf: () => 'ak47' };
  a.weaponOf = (l) => (l.side === 'CT' ? 'm4' : 'ak47');
  const areas = map.areas.map((x) => x.id);
  const spawnFor = (side: Side): AreaId => {
    const enemies = a.players.filter((l) => l.alive && l.side !== side).map((l) => l.area);
    const free = areas.filter((id) => !enemies.includes(id));
    return rng.pick(free.length ? free : areas);
  };
  config.teams.forEach((team, ti) => {
    for (const p of team.players) {
      const side: Side = ti === 0 ? 'CT' : 'T';
      a.players.push(mkLive(p, side, ti as 0 | 1, map.spawns[side], true));
    }
  });
  roundStart(a, a.players);
  // Scatter at t=0.
  for (const l of a.players) {
    l.area = spawnFor(l.side);
    emit(a, { type: 'respawn', round: 1, t: 0, player: l.id, area: l.area });
    l.busyUntil = rng.int(0, 2);
  }
  const neighbours = (id: AreaId): AreaId[] => {
    const out = new Set<AreaId>();
    for (const r of map.routes) {
      if (r.from === id) out.add(r.to);
      if (r.to === id) out.add(r.from);
    }
    return [...out];
  };
  const nearestEnemyArea = (l: Live): AreaId | null => {
    let best: { area: AreaId; time: number } | null = null;
    for (const e of a.players) {
      if (!e.alive || e.side === l.side) continue;
      const p = shortestPath(map, l.area, e.area);
      if (p && (!best || p.time < best.time)) best = { area: e.area, time: p.time };
    }
    return best?.area ?? null;
  };

  for (let t = 0; t < durationSec; t++) {
    // Respawns.
    for (const l of a.players) {
      if (!l.alive && l.respawnAt >= 0 && l.respawnAt <= t) {
        l.alive = true;
        l.hp = 100;
        l.area = spawnFor(l.side);
        l.settledAt = t;
        l.busyUntil = t + 1;
        l.respawnAt = -1;
        emit(a, { type: 'respawn', round: 1, t, player: l.id, area: l.area });
      }
    }
    // Free players act in a deterministic order.
    for (const l of a.players) {
      if (!l.alive || l.busyUntil > t) continue;
      const near = neighbours(l.area);
      const here = a.players
        .filter((e) => e.alive && e.side !== l.side && e.busyUntil <= t + 2 && (e.area === l.area || near.includes(e.area)))
        .sort((x, y) => Number(y.area === l.area) - Number(x.area === l.area));
      if (here.length) {
        const df = here[0] as Live;
        if (df.area !== l.area) {
          // Contact in the adjacent area: step in.
          emit(a, { type: 'move', round: 1, t, player: l.id, from: l.area, to: df.area, duration: 1 });
          l.area = df.area;
          l.settledAt = t;
        }
        const aliveMine = a.players.filter((x) => x.alive && x.side === l.side).length;
        const aliveTheirs = a.players.filter((x) => x.alive && x.side !== l.side).length;
        const { killed } = fight(a, l, df, t + 1, {
          area: l.area,
          defenderHoldingAngle: t - df.settledAt >= 2,
          retakeProT: null,
          fallbackA: rng.pick(neighbours(l.area)),
          fallbackD: rng.pick(neighbours(l.area)),
          aliveA: aliveMine,
          aliveD: aliveTheirs,
        });
        if (killed) killed.respawnAt = t + DRILL.RESPAWN_SECONDS;
        const gap = rng.int(DRILL.DUEL_GAP_MIN, DRILL.DUEL_GAP_MAX);
        if (l.alive) l.busyUntil = Math.max(l.busyUntil, t + DRILL.DM_COOLDOWN + gap - DRILL.DUEL_GAP_MIN);
        if (df.alive) df.busyUntil = Math.max(df.busyUntil, t + DRILL.DM_COOLDOWN);
        continue;
      }
      // Move: hunt the nearest enemy or wander.
      let target: AreaId | null = rng.chance(DRILL.HUNT) ? nearestEnemyArea(l) : null;
      if (!target || target === l.area) target = rng.pick(neighbours(l.area));
      const path = shortestPath(map, l.area, target);
      const next = path && path.path.length > 1 ? (path.path[1] as AreaId) : target;
      l.busyUntil = walk(a, l, next, t);
    }
  }
  const kills0 = a.players.filter((l) => l.team === 0).reduce((s, l) => s + l.kills, 0);
  const kills1 = a.players.filter((l) => l.team === 1).reduce((s, l) => s + l.kills, 0);
  return finishLog(a, 'dm', seed, config.teams, durationSec, kills0 >= kills1 ? 0 : 1, 'time');
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const SCENARIO_SECONDS: Record<ScenarioKind, number> = { aim1v1: 20, peek: 20, rush: 25, retake2v2: 30, retake3v2: 30, execute: 30 };

/** Which call beats which hidden defender setup (Tático training). */
const COUNTER: Record<RetakeCall, RetakeCall> = { padrao: 'padrao', flanco: 'flanco', agressivo: 'agressivo' };

export function simulateScenario(kind: ScenarioKind, config: DrillConfig, seed: number, call?: RetakeCall): ScenarioResult {
  const rng = new Rng(seed);
  const map = config.map;
  const a: Arena = { map, rng, events: [], players: [], duelCounter: 0, lastKillT: 0, retreatBonus: 0, weaponOf: (l) => (l.side === 'CT' ? 'm4' : 'ak47') };
  const me = { ...config.me, id: config.me.id };
  const mates = (n: number, classes: PlayerClass[]) => generateBotTeam({ rng, targetAvg: config.botAvg, idPrefix: 'x', classes }).players.slice(0, n).map((p, i) => ({ ...p, id: `a${i + 2}` }));
  const foes = (n: number, classes: PlayerClass[]) => generateBotTeam({ rng, targetAvg: config.botAvg, idPrefix: 'b', classes }).players.slice(0, n);
  const durationSec = SCENARIO_SECONDS[kind];
  const site = kind === 'retake2v2' ? map.sites.B : map.sites.A;
  let attackers: Live[] = [];
  let defenders: Live[] = [];
  let respawn = false;
  let retakeProT: 'A' | 'D' | null = null;
  let fightArea: AreaId = site.plant;
  let attackerStart: AreaId = map.spawns.CT;
  let defenderStart: AreaId = map.spawns.T;
  let holdAngle = true;
  let correctCall: RetakeCall | undefined;
  let attackerDelay = 0;

  switch (kind) {
    case 'aim1v1': {
      // Mid duel with respawns: best score over 20s.
      fightArea = map.mid.contact;
      attackerStart = map.mid.contact;
      defenderStart = map.mid.contact;
      attackers = [mkLive(me, 'CT', 0, attackerStart, true)];
      defenders = foes(1, ['rifler']).map((p) => mkLive(p, 'T', 1, defenderStart, false));
      respawn = true;
      holdAngle = false;
      break;
    }
    case 'peek': {
      // The character swings on a bot holding a fresh angle, repeatedly.
      fightArea = site.entrances[0];
      attackerStart = map.spawns.T === site.entrances[0] ? map.spawns.T : (shortestPath(map, map.spawns.T, site.entrances[0])?.path.at(-2) as AreaId) ?? map.spawns.T;
      defenderStart = site.plant;
      attackers = [mkLive(me, 'CT', 0, attackerStart, true)];
      defenders = foes(1, ['anchor']).map((p) => mkLive(p, 'T', 1, defenderStart, false));
      respawn = true;
      holdAngle = true;
      break;
    }
    case 'rush':
    case 'execute': {
      attackerStart = kind === 'rush' ? (shortestPath(map, map.spawns.T, site.entrances[0])?.path.at(-2) as AreaId) ?? map.spawns.T : site.entrances[1];
      defenderStart = site.plant;
      attackers = [mkLive(me, 'CT', 0, attackerStart, true), ...mates(2, ['entry', 'rifler']).map((p) => mkLive(p, 'CT', 0, attackerStart, true))];
      defenders = foes(2, ['anchor', 'rifler']).map((p) => mkLive(p, 'T', 1, defenderStart, false));
      attackerDelay = kind === 'execute' ? 6 : 0;
      break;
    }
    case 'retake2v2':
    case 'retake3v2': {
      const n = kind === 'retake2v2' ? 1 : 2;
      attackerStart = map.spawns.CT;
      defenderStart = site.plant;
      attackers = [mkLive(me, 'CT', 0, attackerStart, true), ...mates(n, ['rifler', 'entry']).map((p) => mkLive(p, 'CT', 0, attackerStart, true))];
      defenders = foes(2, ['rifler', 'anchor']).map((p) => mkLive(p, 'T', 1, defenderStart, false));
      retakeProT = 'D';
      // Hidden setup: the right call breaks their angles; the wrong one walks into them.
      const setup = rng.pick(RETAKE_CALLS);
      correctCall = COUNTER[setup];
      const used = call ?? 'padrao';
      if (used === correctCall) holdAngle = false;
      if (used === 'agressivo') attackerDelay = -3;
      if (used === 'flanco') attackerDelay = 4;
      break;
    }
  }

  a.players = [...attackers, ...defenders];
  const teams: [Team, Team] = [
    { id: 'a', name: 'Treino', players: attackers.map((l) => l.base) },
    { id: 'b', name: 'Bots', players: defenders.map((l) => l.base) },
  ];
  roundStart(a, a.players);
  for (const l of a.players) emit(a, { type: 'respawn', round: 1, t: 0, player: l.id, area: l.area });
  // Defenders set up first, attackers arrive.
  for (const d of defenders) d.busyUntil = walk(a, d, fightArea, 0);
  attackers.forEach((l, i) => {
    l.busyUntil = walk(a, l, fightArea, Math.max(0, 1 + i * 2 + attackerDelay));
  });

  let myDuels = 0;
  let myWins = 0;
  let winner: 0 | 1 | null = null;
  let endT = durationSec;
  const meId = me.id;

  for (let t = 0; t < durationSec && winner === null; t++) {
    for (const l of a.players) {
      if (!l.alive && respawn && l.respawnAt >= 0 && l.respawnAt <= t) {
        l.alive = true;
        l.hp = 100;
        l.area = l.attacker ? attackerStart : defenderStart;
        emit(a, { type: 'respawn', round: 1, t, player: l.id, area: l.area });
        l.busyUntil = walk(a, l, fightArea, t + 1);
      }
    }
    const pa = attackers.filter((l) => l.alive && l.busyUntil <= t && l.area === fightArea);
    const pd = defenders.filter((l) => l.alive && l.busyUntil <= t && l.area === fightArea);
    if (!respawn) {
      if (attackers.every((l) => !l.alive)) {
        winner = 1;
        endT = a.lastKillT;
        break;
      }
      if (defenders.every((l) => !l.alive)) {
        winner = 0;
        endT = a.lastKillT;
        break;
      }
    }
    if (!pa.length || !pd.length) continue;
    const at = pa.slice().sort((x, y) => x.engagements - y.engagements)[0] as Live;
    const df = pd.slice().sort((x, y) => x.engagements - y.engagements)[0] as Live;
    const { winner: w, killed } = fight(a, at, df, t, {
      area: fightArea,
      defenderHoldingAngle: holdAngle && t - df.settledAt >= 2,
      retakeProT,
      fallbackA: attackerStart,
      fallbackD: defenderStart,
      aliveA: attackers.filter((l) => l.alive).length,
      aliveD: defenders.filter((l) => l.alive).length,
    });
    if (at.id === meId || df.id === meId) {
      myDuels++;
      if (w.id === meId) myWins++;
    }
    if (killed) {
      if (respawn) killed.respawnAt = t + DRILL.RESPAWN_SECONDS;
    }
    const gap = rng.int(DRILL.DUEL_GAP_MIN, DRILL.DUEL_GAP_MAX);
    for (const l of [at, df]) if (l.alive) l.busyUntil = Math.max(l.busyUntil, t + gap);
    // A retreated player walks back into the fight.
    for (const l of [at, df]) if (l.alive && l.area !== fightArea) l.busyUntil = walk(a, l, fightArea, l.busyUntil);
  }

  const mine = a.players.find((l) => l.id === meId) as Live;
  let won: boolean;
  if (respawn) {
    const foe = defenders[0] as Live;
    won = mine.kills > mine.deaths || (mine.kills === mine.deaths && mine.damage > foe.damage);
    winner = won ? 0 : 1;
  } else if (winner === null) {
    won = false;
    winner = 1;
  } else won = winner === 0;
  const log = finishLog(a, kind, seed, teams, endT, winner, respawn || endT === durationSec ? 'time' : 'elimination');
  const result: ScenarioResult = { kind, title: SCENARIO_TITLE[kind], won, duels: myDuels, duelsWon: myWins, timeSec: endT, log };
  if (correctCall) {
    result.call = call ?? 'padrao';
    result.correctCall = correctCall;
  }
  return result;
}
