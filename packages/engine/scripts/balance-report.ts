/**
 * Quick balance report for tuning. Run with:
 *   npm run balance:report -- [n]
 */
import { MAP01 } from '../src/data/maps/map01';
import { generateBotMatchup } from '../src/bots';
import { freshInventory } from '../src/economy';
import { simulateMatch } from '../src/match';
import { ATTR_KEYS, type Team } from '../src/player';
import { Rng } from '../src/rng';
import { simulateRound, type RoundTeam } from '../src/round';
import { BOT_CLASSES } from '../src/bots';
import { makePlayer, uniformAttrs } from '../src/player';
const uniformTeam = (prefix: string, avg: number, seed: number): Team => ({ id: prefix, name: prefix + seed, players: BOT_CLASSES.map((c, i) => makePlayer(`${prefix}${i}`, `${prefix}${i}`, c, uniformAttrs(avg))) });

const n = Number(process.argv[2] ?? 1000);
const uniform = process.argv.includes('--uniform');
const mk = (seed: number, a = 50, b = 50) => uniform ? [uniformTeam('a', a, seed), uniformTeam('b', b, seed + 1)] as [Team, Team] : generateBotMatchup(new Rng(seed), a, b);
const plus = (team: Team, d: number): Team => ({
  ...team,
  players: team.players.map((p) => {
    const attrs = { ...p.attrs };
    for (const k of ATTR_KEYS) attrs[k] = Math.min(100, attrs[k] + d);
    return { ...p, attrs };
  }),
});
const rt = (team: Team, index: 0 | 1, side: 'CT' | 'T', money: number): RoundTeam => ({
  index,
  lossStreak: 0,
  players: team.players.map((p) => ({ id: p.id, team: index, base: p, money, inv: freshInventory(side), mental: p.attrs.mental })),
});

const t0 = Date.now();
let winA = 0, plusWin = 0, pistolConv = 0, pistolTot = 0, rounds = 0, blow = 0, ot = 0, ctRounds = 0, totalRounds = 0;
let kills = 0, deaths = 0, kast = 0, dmg = 0, assists = 0, planted = 0;
const ratings: number[] = [];
const byClass: Record<string, { n: number; k: number; d: number; r: number; kast: number }> = {};
const reasons: Record<string, number> = {};
const multi = [0, 0, 0, 0, 0, 0];
const buys: Record<string, number> = {};
for (let i = 0; i < n; i++) {
  const teams = mk(1000 + i);
  const log = simulateMatch({ map: MAP01, teams, startingCT: (i % 2) as 0 | 1 }, 1000 + i);
  if (log.winner === 0) winA++;
  rounds += log.rounds.length;
  if (log.overtime) ot++;
  if (!log.overtime && Math.min(...log.score) <= 2) blow++;
  for (const idx of [0, 12]) {
    const p = log.rounds[idx], q = log.rounds[idx + 1];
    if (p && q) { pistolTot++; if (p.winnerTeam === q.winnerTeam) pistolConv++; }
  }
  for (const r of log.rounds) {
    totalRounds++;
    if (r.winner === 'CT') ctRounds++;
    reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
    buys[`CT:${r.buy.CT}`] = (buys[`CT:${r.buy.CT}`] ?? 0) + 1;
    buys[`T:${r.buy.T}`] = (buys[`T:${r.buy.T}`] ?? 0) + 1;
    if (r.planted) planted++;
  }
  for (const r of log.rounds) {
    const per: Record<string, number> = {};
    for (const e of log.events) if (e.round === r.round && e.type === 'kill') per[e.attacker] = (per[e.attacker] ?? 0) + 1;
    for (const p of log.stats) multi[Math.min(5, per[p.id] ?? 0)]++;
  }
  for (const s of log.stats) {
    ratings.push(s.rating); kills += s.kills; deaths += s.deaths; kast += s.kastRounds; dmg += s.damage; assists += s.assists;
    const cls = teams[s.team].players.find((p) => p.id === s.id)!.class;
    const c = (byClass[cls] ??= { n: 0, k: 0, d: 0, r: 0, kast: 0 });
    c.n++; c.k += s.kills / s.rounds; c.d += s.deaths / s.rounds; c.r += s.rating; c.kast += s.kastRounds / s.rounds;
  }

  const [a, b] = mk(2000 + i);
  const log2 = simulateMatch({ map: MAP01, teams: [plus(a, 10), b], startingCT: (i % 2) as 0 | 1 }, 2000 + i);
  if (log2.winner === 0) plusWin++;
}
let ecoWins = 0;
for (let i = 0; i < n; i++) {
  const [a, b] = mk(3000 + i);
  const ecoSide = i % 2 === 0 ? 'T' : 'CT';
  const r = simulateRound({
    round: 5, map: MAP01, rng: new Rng(3000 + i), pistol: false,
    ct: rt(a, 0, 'CT', ecoSide === 'CT' ? 1500 : 10000), t: rt(b, 1, 'T', ecoSide === 'T' ? 1500 : 10000),
    score: [2, 2], forceBuy: ecoSide === 'T' ? { CT: 'full', T: 'eco' } : { CT: 'eco', T: 'full' },
  });
  if (r.winner === ecoSide) ecoWins++;
}
const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
const std = Math.sqrt(ratings.reduce((a, b) => a + (b - mean) ** 2, 0) / ratings.length);
const pr = totalRounds / 10; // player-rounds per player… (n matches × rounds) / players
const pct = (x: number) => (x * 100).toFixed(1) + '%';
console.log(`n=${n} matches  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log(`equal teams A wins       ${pct(winA / n)}            target 47–53`);
console.log(`+10 team wins            ${pct(plusWin / n)}            target 62–68`);
console.log(`pistol conversion        ${pct(pistolConv / pistolTot)}            target ≥ 75`);
console.log(`eco wins                 ${pct(ecoWins / n)}            target 12–20`);
console.log(`rating mean / std        ${mean.toFixed(3)} / ${std.toFixed(3)}  target 0.97–1.03 / 0.15–0.25`);
console.log(`blowouts (≤2)            ${pct(blow / n)}            target < 6`);
console.log(`avg rounds               ${(rounds / n).toFixed(2)}             target 22–26   (OT ${pct(ot / n)})`);
console.log(`--- diagnostics`);
console.log(`CT round win             ${pct(ctRounds / totalRounds)}`);
console.log(`KPR / DPR / APR / ADR    ${(kills / (totalRounds * 10)).toFixed(3)} / ${(deaths / (totalRounds * 10)).toFixed(3)} / ${(assists / (totalRounds * 10)).toFixed(3)} / ${(dmg / (totalRounds * 10)).toFixed(1)}`);
console.log(`KAST                     ${pct(kast / (totalRounds * 10))}`);
console.log(`planted                  ${pct(planted / totalRounds)}`);
console.log(`reasons                  ${JSON.stringify(Object.fromEntries(Object.entries(reasons).map(([k, v]) => [k, pct(v / totalRounds)])))}`);
console.log(`buys                     ${JSON.stringify(Object.fromEntries(Object.entries(buys).map(([k, v]) => [k, pct(v / totalRounds)])))}`);
void pr;
const sorted = ratings.slice().sort((a, b) => a - b);
const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))]!.toFixed(2);
const mt = multi.reduce((a, b) => a + b, 0);
console.log(`kills/round 0..5+          ${multi.map((m) => pct(m / mt)).join(' ')}`);
console.log(`rating p5/p25/p50/p75/p95 ${q(0.05)} / ${q(0.25)} / ${q(0.5)} / ${q(0.75)} / ${q(0.95)}`);
for (const [cls, c] of Object.entries(byClass)) console.log(`  ${cls.padEnd(8)} KPR ${(c.k / c.n).toFixed(3)} DPR ${(c.d / c.n).toFixed(3)} KAST ${pct(c.kast / c.n)} rating ${(c.r / c.n).toFixed(3)}`);
