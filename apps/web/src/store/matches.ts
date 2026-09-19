import { clamp } from '../progression/xp';
import { db, notify, type MatchRecord } from './db';

export const MATCH_HISTORY_LIMIT = 200; // GDD 14

export async function saveMatch(record: MatchRecord): Promise<number> {
  const id = (await db.matches.add(record)) as number;
  const count = await db.matches.count();
  if (count > MATCH_HISTORY_LIMIT) {
    const old = await db.matches.orderBy('playedAt').limit(count - MATCH_HISTORY_LIMIT).primaryKeys();
    await db.matches.bulkDelete(old);
  }
  notify();
  return id;
}

export async function listMatches(limit = 20): Promise<MatchRecord[]> {
  return db.matches.orderBy('playedAt').reverse().limit(limit).toArray();
}

export async function getMatch(id: number): Promise<MatchRecord | undefined> {
  return db.matches.get(id);
}

export interface CareerStats {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  kd: number;
  adr: number;
  hsPercent: number;
  /** GDD 8.2: weighted mean, last 50 matches weight 2, the rest weight 1. */
  careerRating: number | null;
  /** GDD 3.1: mean of the last 10. */
  form: number | null;
  /** Rating per match, oldest first. */
  ratings: number[];
}

export function careerFromMatches(all: MatchRecord[]): CareerStats {
  const sorted = all.slice().sort((a, b) => a.playedAt - b.playedAt);
  const n = sorted.length;
  let kills = 0;
  let deaths = 0;
  let damage = 0;
  let rounds = 0;
  let hs = 0;
  let wins = 0;
  let wsum = 0;
  let wtot = 0;
  sorted.forEach((m, i) => {
    kills += m.stats.kills;
    deaths += m.stats.deaths;
    damage += m.stats.damage;
    rounds += m.stats.rounds;
    hs += m.stats.headshots;
    if (m.winner === m.myTeam) wins++;
    const w = i >= n - 50 ? 2 : 1;
    wsum += m.rating * w;
    wtot += w;
  });
  const last10 = sorted.slice(-10);
  return {
    matches: n,
    wins,
    kills,
    deaths,
    kd: deaths ? kills / deaths : kills,
    adr: rounds ? damage / rounds : 0,
    hsPercent: kills ? (100 * hs) / kills : 0,
    careerRating: n ? wsum / wtot : null,
    form: last10.length ? last10.reduce((s, m) => s + m.rating, 0) / last10.length : null,
    ratings: sorted.map((m) => m.rating),
  };
}

export async function career(): Promise<CareerStats> {
  return careerFromMatches(await db.matches.toArray());
}

/** GDD 5.6: forma = clamp(0.85, 1.15, rating recente) */
export function formMultiplier(form: number | null): number {
  return form === null ? 1 : clamp(form, 0.85, 1.15);
}
