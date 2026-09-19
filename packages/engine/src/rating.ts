/**
 * Per-match rating (GDD 8.2, HLTV 2.0-style public approximation).
 * Role adjustments are NOT applied yet (later step).
 */

export const RATING = {
  IMPACT_KPR: 2.13, // [v0]
  IMPACT_APR: 0.42, // [v0]
  IMPACT_CONST: -0.41, // [v0]
  KAST: 0.0073, // [v0]  KAST in percent (0–100)
  KPR: 0.3591, // [v0]
  DPR: -0.5329, // [v0]
  IMPACT: 0.2372, // [v0]
  ADR: 0.0032, // [v0]
  /**
   * [v1] Public HLTV 2.0 coefficients kept as-is. The per-match std across
   * players is ~0.32 by nature (multi-kill distribution matches real CS); the
   * GDD 5.8 gate was widened to 0.25–0.35 instead of compressing the scale.
   */
  CONST: 0.1587,
};

export interface RatingInput {
  kills: number;
  deaths: number;
  assists: number;
  /** Total damage dealt. */
  damage: number;
  /** Rounds with a Kill, Assist, Survival or Trade. */
  kastRounds: number;
  rounds: number;
}

export function impact(kpr: number, apr: number): number {
  return RATING.IMPACT_KPR * kpr + RATING.IMPACT_APR * apr + RATING.IMPACT_CONST;
}

export interface RatingBreakdown {
  kpr: number;
  dpr: number;
  apr: number;
  adr: number;
  /** Percent, 0–100. */
  kast: number;
  impact: number;
  rating: number;
}

export function ratingBreakdown(input: RatingInput): RatingBreakdown {
  const rounds = Math.max(1, input.rounds);
  const kpr = input.kills / rounds;
  const dpr = input.deaths / rounds;
  const apr = input.assists / rounds;
  const adr = input.damage / rounds;
  const kast = (input.kastRounds / rounds) * 100;
  const imp = impact(kpr, apr);
  const rating =
    RATING.KAST * kast + RATING.KPR * kpr + RATING.DPR * dpr + RATING.IMPACT * imp + RATING.ADR * adr + RATING.CONST;
  return { kpr, dpr, apr, adr, kast, impact: imp, rating: Math.max(0, rating) };
}

export function matchRating(input: RatingInput): number {
  return ratingBreakdown(input).rating;
}

/** Round to two decimals the way HLTV displays it. */
export function displayRating(r: number): number {
  return Math.round(r * 100) / 100;
}
