/**
 * Pure matchmaking + settlement for the online queue. No I/O here so it can be
 * unit-tested with fake users in Deno. The engine is the bundled ESM build
 * (no .d.ts), so values from it are typed loosely on purpose.
 */
// deno-lint-ignore-file no-explicit-any
import { MAP01, Rng, averageAttr, generateBotTeam, makePlayer, matchXp, mmrDelta, expectedScore, resolveBuild, simulateMatch } from './engine.js';

export type Attrs = { mira: number; mov: number; peek: number; tatico: number; util: number; mental: number };
export type EquippedCard = { id: string; level: 1 | 2 | 3 };
export type Player = { id: string; nick: string; class: string; attrs: Attrs; build: { cards: EquippedCard[] } };
export type Team = { id: string; name: string; players: Player[] };
export type MatchLog = { seed: number; events: unknown[]; score: number[]; winner: number; stats: { id: string; rating: number }[] };

export interface QueueUser {
  user_id: string;
  nick: string;
  attrs: Attrs;
  build: EquippedCard[];
  color?: string;
  level: number;
  mmr: number;
}

export interface LobbyPlayer {
  player: Player;
  user_id: string | null;
  mmr: number;
  team: 0 | 1;
}

export interface Lobby {
  seed: number;
  teams: [Team, Team];
  players: LobbyPlayer[];
  startingCT: 0 | 1;
}

/** MMR search window: ±150 growing to 400 over the client's retries (every 10s). */
export function rangeForAttempt(attempt: number): number {
  return Math.min(400, 150 + 50 * attempt);
}

const CLASSES = ['igl', 'awper', 'entry', 'anchor', 'rifler', 'support', 'star'];

/**
 * Builds a balanced 5v5: the queuing user is a1 on team 0; real passive
 * characters fill by MMR (snake draft), bots leveled to the lobby average fill
 * the rest.
 */
export function buildLobby(me: QueueUser, pool: QueueUser[], seed: number): Lobby {
  const rng = new Rng(seed);
  const real = [me, ...pool.slice(0, 9)].sort((a, b) => b.mmr - a.mmr);
  const teams: [QueueUser[], QueueUser[]] = [[me], []];
  let t: 0 | 1 = 1;
  for (const u of real) {
    if (u === me) continue;
    while (teams[t].length >= 5) t = t === 0 ? 1 : 0;
    teams[t].push(u);
    t = t === 0 ? 1 : 0;
  }
  const avgAttr = Math.round(real.reduce((s, u) => s + averageAttr(u.attrs), 0) / real.length);
  const players: LobbyPlayer[] = [];
  const mk = (prefix: 'a' | 'b', team: 0 | 1, users: QueueUser[]): Team => {
    const out: Player[] = [];
    users.forEach((u, i) => {
      const id = `${prefix}${i + 1}`;
      const build = { cards: u.build ?? [] };
      const p = makePlayer(id, u.nick, resolveBuild(build).activeClass, u.attrs) as Player;
      p.build = build;
      out.push(p);
      players.push({ player: p, user_id: u.user_id, mmr: u.mmr, team });
    });
    if (out.length < 5) {
      const need = 5 - out.length;
      const taken = new Set(out.map((p) => p.class));
      const classes = CLASSES.filter((c) => !taken.has(c)).slice(0, need);
      const bots = generateBotTeam({ rng, targetAvg: avgAttr, idPrefix: `${prefix}x`, classes: classes.length ? classes : ['rifler'] }) as Team;
      bots.players.slice(0, need).forEach((b: Player, j: number) => {
        const id = `${prefix}${out.length + j + 1}`;
        const p = { ...b, id } as Player;
        out.push(p);
        players.push({ player: p, user_id: null, mmr: 1000, team });
      });
    }
    return { id: prefix, name: prefix === 'a' ? `Time de ${me.nick}` : 'Adversários', players: out };
  };
  const teamA = mk('a', 0, teams[0]);
  const teamB = mk('b', 1, teams[1]);
  return { seed, teams: [teamA, teamB], players, startingCT: rng.pick([0, 1]) as 0 | 1 };
}

export interface Participation {
  user_id: string;
  present: boolean;
  team: 0 | 1;
  player_id: string;
  rating: number;
  mmr_delta: number;
  xp: number;
  won: boolean;
}

export interface Settlement {
  log: MatchLog;
  participations: Participation[];
}

/** Passive characters (owner away): fixed small XP, no MMR, no career rating (GDD 4.4 v1). */
export const PASSIVE_XP = 15;
/** Chance a passive participation drops a box. */
export const PASSIVE_BOX_CHANCE = 0.05;

/** Simulates and computes rewards: the present user moves MMR and earns XP ×1.6; passives keep MMR and get PASSIVE_XP. */
export function settle(lobby: Lobby, presentUserId: string): Settlement {
  const log = simulateMatch({ map: MAP01, teams: lobby.teams, startingCT: lobby.startingCT }, lobby.seed) as unknown as MatchLog;
  const teamMmr = (team: 0 | 1) => {
    const list = lobby.players.filter((p) => p.team === team);
    return list.reduce((s, p) => s + p.mmr, 0) / list.length;
  };
  const participations: Participation[] = [];
  for (const lp of lobby.players) {
    if (!lp.user_id) continue;
    const stats = log.stats.find((s) => s.id === lp.player.id);
    if (!stats) continue;
    const won = log.winner === lp.team;
    const present = lp.user_id === presentUserId;
    const expected = expectedScore(teamMmr(lp.team), teamMmr(lp.team === 0 ? 1 : 0));
    const delta = present ? mmrDelta(won, expected, stats.rating) : 0;
    const full = matchXp({ won, rating: stats.rating, minigameAvg: null, mode: 'online' }).xp as number;
    participations.push({ user_id: lp.user_id, present, team: lp.team, player_id: lp.player.id, rating: stats.rating, mmr_delta: delta, xp: present ? full : PASSIVE_XP, won });
  }
  return { log, participations };
}

/** FNV-1a over the serialised events: the client checks the same hash after replaying. */
export function logHash(log: MatchLog): string {
  const s = JSON.stringify(log.events);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
