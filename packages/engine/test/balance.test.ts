/**
 * Balance gates (GDD 5.8). 5.000 matches per scenario. If a range breaks,
 * tune the [v0] coefficients in src/ — never the ranges here.
 */
import { describe, expect, it } from 'vitest';
import { MAP01 } from '../src/data/maps/map01';
import { simulateMatch, type MatchConfig } from '../src/match';
import type { MatchLog } from '../src/events';
import { ATTR_KEYS, type Team } from '../src/player';
import { Rng } from '../src/rng';
import { simulateRound } from '../src/round';
import { botTeams, roundTeam } from './helpers';

const N = 5000;

interface Summary {
  winner: 0 | 1;
  score: [number, number];
  rounds: number;
  overtime: boolean;
  ratings: number[];
  /** Pistol rounds (1 and 13): did the winner also take the next round? */
  pistolConverted: number;
  pistolTotal: number;
}

function summarize(log: MatchLog): Summary {
  let pistolConverted = 0;
  let pistolTotal = 0;
  for (const idx of [0, 12]) {
    const pistol = log.rounds[idx];
    const next = log.rounds[idx + 1];
    if (pistol && next) {
      pistolTotal++;
      if (pistol.winnerTeam === next.winnerTeam) pistolConverted++;
    }
  }
  return {
    winner: log.winner,
    score: log.score,
    rounds: log.rounds.length,
    overtime: log.overtime,
    ratings: log.stats.map((s) => s.rating),
    pistolConverted,
    pistolTotal,
  };
}

/** Runs `n` matches without retaining the logs (memory). */
export async function runMany(n: number, cfgFactory: (i: number) => { config: MatchConfig; seed: number }): Promise<Summary[]> {
  const out: Summary[] = [];
  for (let i = 0; i < n; i++) {
    const { config, seed } = cfgFactory(i);
    out.push(summarize(simulateMatch(config, seed)));
  }
  return out;
}

function plus(team: Team, delta: number): Team {
  return {
    ...team,
    players: team.players.map((p) => {
      const attrs = { ...p.attrs };
      for (const k of ATTR_KEYS) attrs[k] = Math.min(100, attrs[k] + delta);
      return { ...p, attrs };
    }),
  };
}

const equalCfg = (i: number) => {
  const teams = botTeams(1000 + i, 50, 50);
  return { config: { map: MAP01, teams, startingCT: (i % 2) as 0 | 1 }, seed: 1000 + i };
};
const plusTenCfg = (i: number) => {
  const [a, b] = botTeams(2000 + i, 50, 50);
  return { config: { map: MAP01, teams: [plus(a, 10), b] as [Team, Team], startingCT: (i % 2) as 0 | 1 }, seed: 2000 + i };
};

let equalBatch: Promise<Summary[]> | undefined;
const equal = () => (equalBatch ??= runMany(N, equalCfg));
let plusBatch: Promise<Summary[]> | undefined;
const plusTen = () => (plusBatch ??= runMany(N, plusTenCfg));

const pct = (x: number) => Math.round(x * 1000) / 10;

describe.concurrent('balance (GDD 5.8)', () => {
  it('equal teams → 50% ± 3', async () => {
    const s = await equal();
    const winA = s.filter((m) => m.winner === 0).length / s.length;
    console.log(`[balance] equal teams: team A wins ${pct(winA)}%`);
    expect(winA).toBeGreaterThanOrEqual(0.47);
    expect(winA).toBeLessThanOrEqual(0.53);
  });

  it('team +10 in every attribute → 70–76% [v1]', async () => {
    const s = await plusTen();
    const win = s.filter((m) => m.winner === 0).length / s.length;
    console.log(`[balance] +10 team wins ${pct(win)}%`);
    expect(win).toBeGreaterThanOrEqual(0.7);
    expect(win).toBeLessThanOrEqual(0.76);
  });

  it('pistol winner takes round 2 in ≥ 75%', async () => {
    const s = await equal();
    const conv = s.reduce((a, m) => a + m.pistolConverted, 0) / s.reduce((a, m) => a + m.pistolTotal, 0);
    console.log(`[balance] pistol conversion ${pct(conv)}%`);
    expect(conv).toBeGreaterThanOrEqual(0.75);
  });

  it('eco vs full buy ($2400 save vs $10000) → eco wins 12–20%', async () => {
    let ecoWins = 0;
    for (let i = 0; i < N; i++) {
      const [a, b] = botTeams(3000 + i, 50, 50);
      const ecoSide = i % 2 === 0 ? 'T' : 'CT';
      const ct = roundTeam(a, 0, 'CT', ecoSide === 'CT' ? 2400 : 10000);
      const t = roundTeam(b, 1, 'T', ecoSide === 'T' ? 2400 : 10000);
      const r = simulateRound({
        round: 5,
        map: MAP01,
        rng: new Rng(3000 + i),
        pistol: false,
        ct,
        t,
        score: [2, 2],
        forceBuy: ecoSide === 'T' ? { CT: 'full', T: 'eco' } : { CT: 'eco', T: 'full' },
      });
      if (r.winner === ecoSide) ecoWins++;
    }
    const rate = ecoWins / N;
    console.log(`[balance] eco wins ${pct(rate)}%`);
    expect(rate).toBeGreaterThanOrEqual(0.12);
    expect(rate).toBeLessThanOrEqual(0.2);
  });

  it('rating mean ≈ 1.00 ± 0.03, std 0.25–0.35 [v1]', async () => {
    const s = await equal();
    const all = s.flatMap((m) => m.ratings);
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    const std = Math.sqrt(all.reduce((a, b) => a + (b - mean) ** 2, 0) / all.length);
    console.log(`[balance] rating mean ${mean.toFixed(3)} std ${std.toFixed(3)}`);
    expect(mean).toBeGreaterThanOrEqual(0.97);
    expect(mean).toBeLessThanOrEqual(1.03);
    expect(std).toBeGreaterThanOrEqual(0.25);
    expect(std).toBeLessThanOrEqual(0.35);
  });

  it('blowouts (13–0 to 13–2) < 6% with equal teams', async () => {
    const s = await equal();
    const blowouts = s.filter((m) => !m.overtime && Math.min(...m.score) <= 2).length / s.length;
    console.log(`[balance] blowouts ${pct(blowouts)}%`);
    expect(blowouts).toBeLessThan(0.06);
  });

  it('average match length 22–26 rounds', async () => {
    const s = await equal();
    const avg = s.reduce((a, m) => a + m.rounds, 0) / s.length;
    console.log(`[balance] avg rounds ${avg.toFixed(2)}`);
    expect(avg).toBeGreaterThanOrEqual(22);
    expect(avg).toBeLessThanOrEqual(26);
  });
});
