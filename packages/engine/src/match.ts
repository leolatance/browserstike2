/**
 * Match simulation (GDD 5.1): `simulateMatch(config, seed) → MatchLog`.
 * MR12 with MR3 overtime, side swap, economy settlement, Mental swings and
 * per-player stats + rating. The whole match resolves in one call.
 */
import { addMoney, freshInventory, nextLossStreak, OT_START_MONEY, roundIncome, START_MONEY } from './economy';
import type { MatchEvent, MatchLog, MatchLogTeam, PlayerStats, RoundSummary, Side, TCall } from './events';
import type { MapDef } from './map';
import { clampAttr, initialMental, type Team } from './player';
import { ratingBreakdown } from './rating';
import { Rng } from './rng';
import { simulateRound, type RoundPlayer, type RoundTeam } from './round';

export interface MatchConfig {
  map: MapDef;
  teams: [Team, Team];
  /** Rounds per regulation half. Default 12. */
  mr?: number;
  /** Rounds per overtime half. Default 3. */
  otMr?: number;
  /** Team index that starts as CT. Default 0. */
  startingCT?: 0 | 1;
}

export const MENTAL = {
  LOSE_ROUND: -2, // [v0]
  LOSE_STREAK_3: -5, // [v0] extra on the 3rd consecutive loss (and beyond)
  WIN_CLUTCH: 6, // [v0]
  SUFFER_ACE: -4, // [v0]
  WIN_PISTOL: 3, // [v0]
};

interface TeamState {
  index: 0 | 1;
  team: Team;
  players: RoundPlayer[];
  lossStreak: number;
  consecutiveLosses: number;
}

export function simulateMatch(config: MatchConfig, seed: number): MatchLog {
  const rng = new Rng(seed);
  const mr = config.mr ?? 12;
  const otMr = config.otMr ?? 3;
  const startingCT: 0 | 1 = config.startingCT ?? 0;
  const map = config.map;

  const states: [TeamState, TeamState] = [mkTeamState(config.teams[0], 0), mkTeamState(config.teams[1], 1)];
  const score: [number, number] = [0, 0];
  const events: MatchEvent[] = [];
  const rounds: RoundSummary[] = [];
  const agg = new Map<string, PlayerStats>();
  for (const s of states) for (const p of s.players) agg.set(p.id, emptyStats(p.id, s.index));

  let target = mr + 1;
  let overtime = false;
  let prevTCall: TCall | undefined;
  let winner: 0 | 1 | null = null;

  for (let round = 1; winner === null && round <= 200; round++) {
    const ot = round > 2 * mr;
    const ctIndex = ctFor(round, mr, otMr, startingCT);
    const tIndex: 0 | 1 = ctIndex === 0 ? 1 : 0;
    const sides: Record<Side, 0 | 1> = { CT: ctIndex, T: tIndex };
    const pistol = round === 1 || round === mr + 1;
    const halfStart = pistol || (ot && (round - 2 * mr - 1) % otMr === 0);

    if (halfStart) {
      for (const side of ['CT', 'T'] as Side[]) {
        const st = states[sides[side]];
        st.lossStreak = 0;
        for (const p of st.players) {
          p.money = ot ? OT_START_MONEY : START_MONEY;
          p.inv = freshInventory(side);
        }
      }
    }

    const ctTeam: RoundTeam = { index: ctIndex, players: states[ctIndex].players, lossStreak: states[ctIndex].lossStreak };
    const tTeam: RoundTeam = { index: tIndex, players: states[tIndex].players, lossStreak: states[tIndex].lossStreak };
    const result = simulateRound({
      round,
      map,
      rng,
      pistol,
      ct: ctTeam,
      t: tTeam,
      score: [score[0], score[1]],
      ...(prevTCall ? { prevTCall } : {}),
    });
    prevTCall = result.call;
    events.push(...result.events);
    score[result.winnerTeam]++;
    rounds.push({
      round,
      winner: result.winner,
      winnerTeam: result.winnerTeam,
      reason: result.reason,
      score: [score[0], score[1]],
      buy: result.buy,
      sides,
      duration: result.duration,
      planted: result.planted,
    });

    // ---- settlement: money, inventories, mental
    const survivors = new Set(result.survivors);
    for (const side of ['CT', 'T'] as Side[]) {
      const st = states[sides[side]];
      const won = result.winner === side;
      st.lossStreak = nextLossStreak(st.lossStreak, won);
      st.consecutiveLosses = won ? 0 : st.consecutiveLosses + 1;
      const aceSuffered = result.ace !== undefined && !st.players.some((p) => p.id === result.ace);
      for (const p of st.players) {
        const alive = survivors.has(p.id);
        p.money = addMoney(
          p.money,
          roundIncome({ won, side, reason: result.reason, planted: result.planted, alive, lossStreak: st.lossStreak }),
        );
        if (!alive) p.inv = freshInventory(side);
        else p.inv = { ...p.inv, utils: [] };

        let dm = 0;
        if (!won) dm += MENTAL.LOSE_ROUND;
        if (!won && st.consecutiveLosses >= 3) dm += MENTAL.LOSE_STREAK_3;
        if (won && pistol) dm += MENTAL.WIN_PISTOL;
        if (aceSuffered) dm += MENTAL.SUFFER_ACE;
        if (result.clutch?.player === p.id) dm += MENTAL.WIN_CLUTCH;
        p.mental = clampAttr(p.mental + dm);
      }
    }

    // ---- stats
    for (const [id, s] of Object.entries(result.stats)) {
      const a = agg.get(id)!;
      a.rounds++;
      a.kills += s.kills;
      a.deaths += s.died ? 1 : 0;
      a.assists += s.assists;
      a.flashAssists += s.flashAssists;
      a.headshots += s.headshots;
      a.damage += s.damage;
      if (s.kast) a.kastRounds++;
      if (s.entryKill) a.entryKills++;
      if (s.entryDeath) a.entryDeaths++;
      if (s.kills >= 2 && s.kills <= 5) a.multiKills[s.kills as 2 | 3 | 4 | 5]++;
      if (s.clutchAttempt) a.clutchAttempts++;
      if (s.clutchWon) a.clutchesWon++;
      if (s.planted) a.plants++;
      if (s.defused) a.defuses++;
    }

    // ---- win / overtime
    if (score[0] === target) winner = 0;
    else if (score[1] === target) winner = 1;
    else if (score[0] === target - 1 && score[1] === target - 1) {
      target += otMr;
      overtime = true;
    }
  }

  const stats: PlayerStats[] = [];
  for (const s of states) {
    for (const p of s.players) {
      const a = agg.get(p.id)!;
      const b = ratingBreakdown(a);
      a.rating = b.rating;
      a.adr = b.adr;
      a.kast = b.kast;
      stats.push(a);
    }
  }

  const teams: [MatchLogTeam, MatchLogTeam] = [logTeam(config.teams[0]), logTeam(config.teams[1])];
  return {
    version: 1,
    seed,
    mapId: map.id,
    teams,
    startingSides: { CT: startingCT, T: startingCT === 0 ? 1 : 0 },
    events,
    rounds,
    score,
    winner: winner ?? (score[0] > score[1] ? 0 : 1),
    overtime,
    stats,
  };
}

/** Which team index plays CT in `round`. Sides swap at half and every OT half. */
export function ctFor(round: number, mr: number, otMr: number, startingCT: 0 | 1): 0 | 1 {
  const other: 0 | 1 = startingCT === 0 ? 1 : 0;
  if (round <= mr) return startingCT;
  if (round <= 2 * mr) return other;
  const otHalf = Math.floor((round - 2 * mr - 1) / otMr);
  // First OT half keeps the second-half sides, then alternates. [v0]
  return otHalf % 2 === 0 ? other : startingCT;
}

function mkTeamState(team: Team, index: 0 | 1): TeamState {
  return {
    index,
    team,
    players: team.players.map((p) => ({
      id: p.id,
      team: index,
      base: p,
      money: START_MONEY,
      inv: freshInventory(index === 0 ? 'CT' : 'T'),
      mental: initialMental(p),
    })),
    lossStreak: 0,
    consecutiveLosses: 0,
  };
}

function logTeam(team: Team): MatchLogTeam {
  return { id: team.id, name: team.name, players: team.players.map((p) => ({ id: p.id, nick: p.nick, class: p.class })) };
}

function emptyStats(id: string, team: 0 | 1): PlayerStats {
  return {
    id,
    team,
    kills: 0,
    deaths: 0,
    assists: 0,
    flashAssists: 0,
    headshots: 0,
    damage: 0,
    kastRounds: 0,
    rounds: 0,
    entryKills: 0,
    entryDeaths: 0,
    multiKills: { 2: 0, 3: 0, 4: 0, 5: 0 },
    clutchesWon: 0,
    clutchAttempts: 0,
    plants: 0,
    defuses: 0,
    rating: 0,
    adr: 0,
    kast: 0,
  };
}
