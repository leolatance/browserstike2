/**
 * MMR / patente (GDD 8.3): Elo K=25 damped by the match rating, 10 tiers with
 * original names, season soft reset. Pure functions shared by the client and
 * the edge function.
 */
export const MMR = {
  START: 1000, // [v1]
  K: 25, // [v0] GDD 8.3
  /** f = clamp((rating − 1) × DAMP, −CLAMP, +CLAMP) */
  DAMP: 0.8, // [v0]
  CLAMP: 0.4, // [v0]
  /** Passive characters count rating with this weight and never move MMR. */
  PASSIVE_RATING_WEIGHT: 0.5, // [v0] GDD 4.4
};

export function expectedScore(mmr: number, opponentMmr: number): number {
  return 1 / (1 + Math.pow(10, (opponentMmr - mmr) / 400));
}

/** GDD 8.3: carry loses less, carried gains less. */
export function mmrDelta(won: boolean, expected: number, rating: number): number {
  const f = Math.max(-MMR.CLAMP, Math.min(MMR.CLAMP, (rating - 1) * MMR.DAMP));
  const d = won ? MMR.K * (1 - expected) * (1 + f) : -MMR.K * expected * (1 - f);
  return Math.round(d);
}

/** Soft reset between seasons: halfway back to the centre. */
export function softReset(mmr: number): number {
  return Math.round((mmr + MMR.START) / 2);
}

export interface RankTier {
  tier: number;
  name: string;
  /** Minimum MMR (inclusive). */
  min: number;
}

/** 10 tiers, original names (not the CS ones). [v1] */
export const RANKS: readonly RankTier[] = [
  { tier: 1, name: 'Novato', min: 0 },
  { tier: 2, name: 'Peão', min: 800 },
  { tier: 3, name: 'Veterano', min: 900 },
  { tier: 4, name: 'Guarda', min: 1000 },
  { tier: 5, name: 'Titã', min: 1100 },
  { tier: 6, name: 'Sentinela', min: 1200 },
  { tier: 7, name: 'Vanguarda', min: 1300 },
  { tier: 8, name: 'Comandante', min: 1450 },
  { tier: 9, name: 'Elite', min: 1600 },
  { tier: 10, name: 'Imortal', min: 1800 },
];

export function rankOf(mmr: number): RankTier {
  let out = RANKS[0] as RankTier;
  for (const r of RANKS) if (mmr >= r.min) out = r;
  return out;
}
