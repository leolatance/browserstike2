/**
 * Balance gates (GDD 5.8). 5.000 matches per scenario. If a range breaks,
 * tune the [v0] coefficients in src/ — never the ranges here.
 */
import { describe, expect, it } from 'vitest';
import { MAP01 } from '../src/data/maps/map01';
import { simulateMatch, type MatchConfig } from '../src/match';
import type { MatchLog } from '../src/events';
import { ATTR_KEYS, makePlayer, resolveBuild, uniformAttrs, type Build, type Team } from '../src/player';
import { generateBotTeam } from '../src/bots';
import { CARDS, type CardLevel } from '../src/data/cards';
import { Rng } from '../src/rng';
import { simulateRound } from '../src/round';
import { botTeams, roundTeam } from './helpers';

/** Matches per scenario. BALANCE_N=1500 is a smoke run (~1 min); the gates are calibrated for 5000. */
const N = Number(process.env.BALANCE_N) || 5000;

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

// ---------------------------------------------------------------------------
// Cards (GDD 6) — gates on the character's own rating, paired seeds: the same
// match (same bots, same seed) is simulated with and without the build and the
// rating difference is averaged. Pairing removes most of the match-to-match
// noise, so n = 1000 is enough. Win rate is logged only as a diagnostic.
// ---------------------------------------------------------------------------
const CHAR_AVG = 26; // level-0 character (attrs rolled 22–30)
const N_CARDS = Number(process.env.BALANCE_N_CARDS) || 1000;

function charMatch(seed: number, build: Build): MatchConfig {
  const rng = new Rng(seed);
  const me = makePlayer('a1', 'me', resolveBuild(build).activeClass, uniformAttrs(CHAR_AVG));
  me.build = build;
  const mates = generateBotTeam({ rng, targetAvg: CHAR_AVG, idPrefix: 'x', classes: ['igl', 'awper', 'entry', 'anchor'] });
  const a: Team = { id: 'a', name: 'A', players: [me, ...mates.players.map((p, i) => ({ ...p, id: `a${i + 2}` }))] };
  const b = generateBotTeam({ rng, targetAvg: CHAR_AVG, idPrefix: 'b' });
  return { map: MAP01, teams: [a, b], startingCT: (seed % 2) as 0 | 1 };
}

const NO_BUILD: Build = { cards: [] };

/** Mean rating gain of the character with `build` vs no cards, paired by seed. */
async function ratingDelta(build: Build, n: number, seedBase: number): Promise<{ delta: number; win: number; winBase: number }> {
  let delta = 0;
  let win = 0;
  let winBase = 0;
  for (let i = 0; i < n; i++) {
    const seed = seedBase + i;
    const withLog = simulateMatch(charMatch(seed, build), seed);
    const baseLog = simulateMatch(charMatch(seed, NO_BUILD), seed);
    delta += withLog.stats.find((s) => s.id === 'a1')!.rating - baseLog.stats.find((s) => s.id === 'a1')!.rating;
    if (withLog.winner === 0) win++;
    if (baseLog.winner === 0) winBase++;
  }
  return { delta: delta / n, win: win / n, winBase: winBase / n };
}

/** Rating gain of every card alone at `level`; the top 8 are re-measured with 3× the sample. */
async function rankCards(level: CardLevel, n: number, seedBase: number): Promise<{ id: string; delta: number }[]> {
  const first: { id: string; delta: number }[] = [];
  for (const c of CARDS) first.push({ id: c.id, delta: (await ratingDelta({ cards: [{ id: c.id, level }] }, n, seedBase)).delta });
  first.sort((x, y) => y.delta - x.delta);
  const out: { id: string; delta: number }[] = [];
  for (const f of first.slice(0, 8)) out.push({ id: f.id, delta: (await ratingDelta({ cards: [{ id: f.id, level }] }, n * 3, seedBase + 100_000)).delta });
  return out.sort((x, y) => y.delta - x.delta).concat(first.slice(8));
}

const fmt = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(3);

describe.concurrent('balance · cards (GDD 6, rating gates)', () => {
  it('best 2-slot build (lvl I) → character rating +0.08 to +0.15', async () => {
    const ranked = await rankCards(1, 200, 7000);
    console.log(`[balance] single-card rating gain (lvl I): ${ranked.slice(0, 6).map((r) => `${r.id} ${fmt(r.delta)}`).join(' · ')}`);
    const build: Build = { cards: ranked.slice(0, 2).map((r) => ({ id: r.id, level: 1 })) };
    const r = await ratingDelta(build, N_CARDS, 8000);
    console.log(`[balance] best 2 slots [${build.cards.map((c) => c.id).join(', ')}] rating ${fmt(r.delta)} · win ${pct(r.win)}% vs ${pct(r.winBase)}% (diagnostic)`);
    expect(r.delta).toBeGreaterThanOrEqual(0.08);
    expect(r.delta).toBeLessThanOrEqual(0.15);
  });

  it('best 6 slots at level III → character rating +0.30 to +0.45', async () => {
    const ranked = await rankCards(3, 200, 7500);
    const candidates = ranked.slice(0, 12).map((r) => r.id);
    const picked: string[] = [];
    for (let step = 0; step < 6; step++) {
      let best: { id: string; delta: number } | null = null;
      for (const id of candidates) {
        if (picked.includes(id)) continue;
        const { delta } = await ratingDelta({ cards: [...picked, id].map((x) => ({ id: x, level: 3 })) }, 200, 7600 + step * 1000);
        if (!best || delta > best.delta) best = { id, delta };
      }
      if (best) picked.push(best.id);
    }
    const build: Build = { cards: picked.map((id) => ({ id, level: 3 })) };
    const r = await ratingDelta(build, N_CARDS, 9000);
    console.log(`[balance] best 6 slots lvl III [${picked.join(', ')}] class ${resolveBuild(build).activeClass} rating ${fmt(r.delta)} · win ${pct(r.win)}% vs ${pct(r.winBase)}% (diagnostic)`);
    expect(r.delta).toBeGreaterThanOrEqual(0.3);
    expect(r.delta).toBeLessThanOrEqual(0.45);
  });
});
