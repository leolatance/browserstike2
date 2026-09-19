/**
 * Training / Deathmatch gains (GDD 4.1, 4.2). Pure functions.
 */
import type { AttrKey, Attrs } from '@idle-strike/engine';
import { attrCap, clamp } from './xp';

export type TrainingMode = 'treino' | 'dm';
export type YieldLabel = 'alto' | 'médio' | 'baixo';

export const TRAINING = {
  FOCUS_GAIN: 0.8, // [v0] GDD 4.1
  SECONDARY_GAIN: 0.2, // [v0]
  /** DM spreads its gain over Mira / Peek / Mov. [v0] */
  DM_GAIN_EACH: 0.35,
  /** Minigame multiplies the gain by 1.0 (didn't play) … MINIGAME_MAX (perfect). [v0] */
  MINIGAME_MAX: 1.5,
  /** Daily diminishing returns: sessions 1–3 100%, 4–6 40%, 7+ 10%. [v0] */
  YIELD_TIERS: [
    [3, 1.0, 'alto'],
    [6, 0.4, 'médio'],
    [Infinity, 0.1, 'baixo'],
  ] as [number, number, YieldLabel][],
  TREINO_SECONDS: 180, // [v0] GDD 4.1 (~3 min)
  DM_SECONDS: 240, // [v0] GDD 4.2 (~4 min)
  /** Target cadence (ms) and visibility per mode. [v0] */
  TREINO_SPAWN_MS: [1500, 3000] as [number, number],
  TREINO_VISIBLE_MS: 900,
  DM_SPAWN_MS: [800, 1600] as [number, number],
  DM_VISIBLE_MS: 700,
};

export const FOCUS_OPTIONS: AttrKey[] = ['mira', 'mov', 'peek', 'tatico', 'util'];
export const DM_ATTRS: AttrKey[] = ['mira', 'peek', 'mov'];

/** `sessionsToday` counts sessions already completed today (before this one). */
export function dailyYield(sessionsToday: number): { factor: number; label: YieldLabel } {
  const n = sessionsToday + 1;
  for (const [upTo, factor, label] of TRAINING.YIELD_TIERS) if (n <= upTo) return { factor, label };
  return { factor: 0.1, label: 'baixo' };
}

/** Average over ALL targets (misses count 0): 0 → ×1.0, 100 → ×MINIGAME_MAX. */
export function trainingMinigameMult(averageAll: number): number {
  return 1 + (TRAINING.MINIGAME_MAX - 1) * clamp(averageAll / 100, 0, 1);
}

/** GDD 4.1: ganho × (1 − (atual/cap)²) */
export function capFactor(current: number, cap: number): number {
  if (cap <= 0) return 0;
  return clamp(1 - (current / cap) ** 2, 0, 1);
}

export interface GainInput {
  mode: TrainingMode;
  focus: AttrKey;
  /** Secondary attribute for treino (random, seeded by the caller). */
  secondary: AttrKey;
  attrs: Attrs;
  level: number;
  minigameAverageAll: number;
  yieldFactor: number;
}

/** Deltas per attribute (already cap-adjusted, never pushing past the cap). */
export function trainingGains(input: GainInput): Partial<Attrs> {
  const cap = attrCap(input.level);
  const mult = trainingMinigameMult(input.minigameAverageAll) * input.yieldFactor;
  const base: Partial<Record<AttrKey, number>> =
    input.mode === 'dm'
      ? { mira: TRAINING.DM_GAIN_EACH, peek: TRAINING.DM_GAIN_EACH, mov: TRAINING.DM_GAIN_EACH }
      : { [input.focus]: TRAINING.FOCUS_GAIN, [input.secondary]: (input.secondary === input.focus ? 0 : TRAINING.SECONDARY_GAIN) };
  const out: Partial<Attrs> = {};
  for (const [k, g] of Object.entries(base) as [AttrKey, number][]) {
    const current = input.attrs[k];
    const delta = Math.min(cap - current, g * mult * capFactor(current, cap));
    out[k] = Math.max(0, Math.round(delta * 100) / 100);
  }
  return out;
}
