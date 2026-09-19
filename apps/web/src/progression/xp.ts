/**
 * XP, levels and attribute caps (GDD 3.1, 3.2, 8.1). Pure functions.
 */
export const XP = {
  BASE: 60, // [v0] GDD 8.1
  WIN: 1.0, // [v0]
  LOSS: 0.6, // [v0]
  MODE_SOLO: 1.0, // [v0]
  MODE_ONLINE: 1.6, // [v0]
  MINIGAME_MAX: 1.3, // [v0] multiplier at average 100
  /** XP to go from level L to L+1 = LEVEL_BASE + LEVEL_STEP · L. [v0] */
  LEVEL_BASE: 100,
  LEVEL_STEP: 35,
  MAX_LEVEL: 50, // [v0] GDD 3.1
  /** Training / DM sessions give a small fixed XP (GDD 4: "baixo"). [v0] */
  TRAINING: 15,
};

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** GDD 3.2: cap = 40 + lvl × 1.2 */
export function attrCap(level: number): number {
  return Math.min(100, 40 + level * 1.2);
}

export function xpForLevel(level: number): number {
  return XP.LEVEL_BASE + XP.LEVEL_STEP * level;
}

/** GDD 8.1: desempenho(0.6 + 0.8·clamp(rating, 0.5, 1.5) − 0.4) */
export function performanceMult(rating: number): number {
  return 0.6 + 0.8 * clamp(rating, 0.5, 1.5) - 0.4;
}

/** 1.0 without minigame, up to MINIGAME_MAX at average 100. */
export function minigameMult(average: number | null): number {
  if (average === null) return 1;
  return 1 + (XP.MINIGAME_MAX - 1) * clamp(average / 100, 0, 1);
}

export interface MatchXpInput {
  won: boolean;
  rating: number;
  /** Minigame average over the match, null when it was off. */
  minigameAvg: number | null;
  mode: 'solo' | 'online';
}

export interface MatchXpBreakdown {
  xp: number;
  base: number;
  result: number;
  performance: number;
  minigame: number;
  mode: number;
}

export function matchXp(input: MatchXpInput): MatchXpBreakdown {
  const result = input.won ? XP.WIN : XP.LOSS;
  const performance = performanceMult(input.rating);
  const minigame = minigameMult(input.minigameAvg);
  const mode = input.mode === 'online' ? XP.MODE_ONLINE : XP.MODE_SOLO;
  return { xp: Math.round(XP.BASE * result * performance * minigame * mode), base: XP.BASE, result, performance, minigame, mode };
}

export interface LevelState {
  level: number;
  xp: number;
}

/** Adds XP and rolls levels over. Returns the new state and the levels reached. */
export function applyXp(state: LevelState, gain: number): LevelState & { reached: number[] } {
  let { level, xp } = state;
  xp += Math.max(0, Math.round(gain));
  const reached: number[] = [];
  while (level < XP.MAX_LEVEL && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    reached.push(level);
  }
  if (level >= XP.MAX_LEVEL) xp = 0;
  return { level, xp, reached };
}
