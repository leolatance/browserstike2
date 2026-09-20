/**
 * x1 de mira: the minigame is the duel. Both clients spawn the same target per
 * round (id from match + round → same position/zone on both), exchange their
 * shots, and each resolves the round locally with the same pure rules.
 */
import { Rng } from '@idle-strike/engine';
import type { Variant } from '../minigames/duelTarget';

export const MIRA = {
  ROUNDS: 10,
  /** Round period: target window (≤1.6s) + reveal. */
  ROUND_MS: 3600,
  /** Shots must arrive before the round's deadline (period minus this). */
  DEADLINE_MARGIN_MS: 400,
  /** First round after the match start. */
  FIRST_ROUND_DELAY_MS: 1500,
  /** Never more than this many tie-break rounds. */
  MAX_EXTRA: 6,
};

export interface Shot {
  round: number;
  score: number;
  reactionMs: number;
  distance: number;
  /** Normalised tap position (0–1) on the board. */
  x: number;
  y: number;
  /** Estimated server timestamp of the tap (ties go to the earlier one). */
  ts: number;
}

export type Side = 'me' | 'them';

const PATTERN: Variant[] = ['timing', 'premira', 'alvo'];

/** Variant of round `n`, from a seed-fixed permutation cycling through the three. */
export function roundVariant(seed: number, n: number): Variant {
  const order = new Rng(seed ^ 0x5bd1e995).shuffle(PATTERN);
  return order[n % 3]!;
}

export function roundTargetId(matchId: number | string, n: number): string {
  return `x1m:${matchId}:${n}`;
}

export function roundStart(startAt: number, n: number): number {
  return startAt + MIRA.FIRST_ROUND_DELAY_MS + n * MIRA.ROUND_MS;
}

export function roundDeadline(startAt: number, n: number): number {
  return roundStart(startAt, n) + MIRA.ROUND_MS - MIRA.DEADLINE_MARGIN_MS;
}

/** Higher score wins; same score → earlier tap; nobody shot (or identical) → no point. */
export function resolveRound(mine: Shot | null, theirs: Shot | null): Side | null {
  const a = mine && mine.score > 0 ? mine : null;
  const b = theirs && theirs.score > 0 ? theirs : null;
  if (!a && !b) return null;
  if (a && !b) return 'me';
  if (b && !a) return 'them';
  if (a!.score !== b!.score) return a!.score > b!.score ? 'me' : 'them';
  if (a!.ts !== b!.ts) return a!.ts < b!.ts ? 'me' : 'them';
  return null;
}

export class MiraMatch {
  readonly shots = new Map<number, { me?: Shot; them?: Shot }>();
  readonly results: (Side | null)[] = [];
  constructor(readonly rounds = MIRA.ROUNDS) {}

  record(side: Side, shot: Shot): void {
    const r = this.shots.get(shot.round) ?? {};
    if (!r[side]) r[side] = shot;
    this.shots.set(shot.round, r);
  }

  /** Resolves round `n` (idempotent). Returns the winner side or null. */
  resolve(n: number): Side | null {
    if (this.results.length > n) return this.results[n]!;
    while (this.results.length < n) this.results.push(null);
    const r = this.shots.get(n) ?? {};
    const w = resolveRound(r.me ?? null, r.them ?? null);
    this.results.push(w);
    return w;
  }

  score(): [number, number] {
    let me = 0;
    let them = 0;
    for (const r of this.results) {
      if (r === 'me') me++;
      else if (r === 'them') them++;
    }
    return [me, them];
  }

  /** Total rounds so far including tie-breaks. */
  played(): number {
    return this.results.length;
  }

  finished(): boolean {
    const n = this.results.length;
    if (n < this.rounds) return false;
    const [a, b] = this.score();
    if (a !== b) return true;
    return n >= this.rounds + MIRA.MAX_EXTRA;
  }

  /** Winner once finished (null = draw after max tie-breaks). */
  winner(): Side | null {
    const [a, b] = this.score();
    return a === b ? null : a > b ? 'me' : 'them';
  }
}
