/**
 * Minigame #1 — "Alvo de duelo" (GDD 10.1). Pure logic, no DOM.
 * A target appears when the player's character enters a duel; hitting it fast
 * and centred scores 0–100. The result NEVER feeds back into the simulation.
 */
import { Rng } from '@idle-strike/engine';

export type Variant = 'alvo' | 'timing' | 'premira' | 'flash';

export const VARIANT_LABEL: Record<Variant, string> = { alvo: 'alvo', timing: 'timing', premira: 'pré-mira', flash: 'flashado' };

export const DUEL_TARGET = {
  VISIBLE_MS: 900,
  /** timing: the bar sweeps in SWEEP_MS, the green zone is ZONE_MS wide; 0 score at ZERO_MS from the centre. */
  SWEEP_MS: 1200,
  ZONE_MS: 180,
  ZERO_MS: 400,
  /** pré-mira: the enemy appears APPEAR_MIN..APPEAR_MAX ms after the corner is shown. */
  APPEAR_MIN_MS: 300,
  APPEAR_MAX_MS: 700,
  /** flashado: white overlay fading over FLASH_MS. */
  FLASH_MS: 300,
  /** Reaction ≤ this is a full reaction score. */
  MIN_REACTION_MS: 150,
  W_REACTION: 0.6,
  W_DISTANCE: 0.4,
  /** Target radius as a fraction of the shorter canvas side. */
  RADIUS: 0.11,
  /** Keep targets away from the edges (fraction of each axis). */
  MARGIN: 0.16,
  PERFECT_MIN: 85,
};

export interface Target {
  id: string;
  /** Situation label shown on the target (does not affect the score). */
  label: string | null;
  variant: Variant;
  /** timing: when the sweep reaches the zone centre (ms since spawn). */
  zoneAtMs: number;
  /** pré-mira: when the enemy shows up (ms since spawn). */
  appearAtMs: number;
  /** Normalised 0..1 position. */
  x: number;
  y: number;
  spawnedAt: number;
}

export interface DuelScore {
  id: string;
  label: string | null;
  hit: boolean;
  score: number;
  reactionMs: number | null;
  /** Distance from centre in target radii (0 = bullseye). */
  distance: number | null;
}

export interface DuelTargetStats {
  last: DuelScore | null;
  /** Mean score over accompanied duels (0 when none). */
  average: number;
  /** Mean over ALL targets, misses count as 0 (training multiplier). */
  averageAll: number;
  accompanied: number;
  total: number;
  /** Consecutive accompanied duels, counted from the latest. */
  streak: number;
  perfect: boolean;
}

/** FNV-1a so the same duel id always yields the same target position. */
export function hashSeed(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function scoreFor(reactionMs: number, distance: number, visibleMs = DUEL_TARGET.VISIBLE_MS): number {
  const r = 100 * (1 - (reactionMs - DUEL_TARGET.MIN_REACTION_MS) / (visibleMs - DUEL_TARGET.MIN_REACTION_MS));
  const d = 100 * (1 - distance);
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return Math.round(DUEL_TARGET.W_REACTION * clamp(r) + DUEL_TARGET.W_DISTANCE * clamp(d));
}

export class DuelTargetGame {
  readonly results: DuelScore[] = [];
  private current: Target | null = null;

  constructor(readonly visibleMs: number = DUEL_TARGET.VISIBLE_MS) {}

  get target(): Target | null {
    return this.current;
  }

  /** Forget everything (the replay was restarted). */
  reset(): void {
    this.results.length = 0;
    this.current = null;
  }

  /** A duel involving the player just started. Any pending target counts as missed. */
  spawn(id: string, nowMs: number, label: string | null = null, at?: { x: number; y: number }, variant: Variant = 'alvo'): Target {
    if (this.current) this.miss();
    const rng = new Rng(hashSeed(id));
    const m = DUEL_TARGET.MARGIN;
    const x = at?.x ?? m + rng.next() * (1 - 2 * m);
    const y = at?.y ?? m + rng.next() * (1 - 2 * m);
    const zoneAtMs = Math.round(DUEL_TARGET.SWEEP_MS * (0.3 + rng.next() * 0.5));
    const appearAtMs = Math.round(DUEL_TARGET.APPEAR_MIN_MS + rng.next() * (DUEL_TARGET.APPEAR_MAX_MS - DUEL_TARGET.APPEAR_MIN_MS));
    this.current = { id, label, variant, zoneAtMs, appearAtMs, x, y, spawnedAt: nowMs };
    return this.current;
  }

  /** How long this target stays up (variant-dependent). */
  windowMs(t: Target): number {
    if (t.variant === 'timing') return DUEL_TARGET.SWEEP_MS;
    if (t.variant === 'premira') return t.appearAtMs + this.visibleMs;
    return this.visibleMs;
  }

  /** Expire the target when its window is over. Returns true if it just expired. */
  tick(nowMs: number): boolean {
    if (this.current && nowMs - this.current.spawnedAt >= this.windowMs(this.current)) {
      this.miss();
      return true;
    }
    return false;
  }

  /**
   * Pointer hit test. `distance` is in target radii from the centre; anything
   * ≥ 1 is outside the target and counts as a miss (score 0, but accompanied).
   */
  pointer(distance: number, nowMs: number): DuelScore | null {
    if (!this.current) return null;
    const t = this.current;
    const sinceSpawn = nowMs - t.spawnedAt;
    let score: number;
    let reactionMs = sinceSpawn;
    if (t.variant === 'timing') {
      // One tap anywhere: score by distance (in time) from the zone centre.
      const off = Math.abs(sinceSpawn - t.zoneAtMs);
      score = off <= DUEL_TARGET.ZONE_MS / 2 ? 100 : Math.round(Math.max(0, 100 * (1 - (off - DUEL_TARGET.ZONE_MS / 2) / (DUEL_TARGET.ZERO_MS - DUEL_TARGET.ZONE_MS / 2))));
      reactionMs = off;
    } else if (t.variant === 'premira') {
      // Tap the head mark before the enemy shows up = 100; after, by reaction.
      const inside = distance < 1;
      if (!inside) score = 0;
      else if (sinceSpawn <= t.appearAtMs) score = 100;
      else {
        reactionMs = sinceSpawn - t.appearAtMs;
        score = scoreFor(reactionMs, distance, this.visibleMs);
      }
    } else {
      const inside = distance < 1;
      score = inside ? scoreFor(reactionMs, distance, this.visibleMs) : 0;
    }
    const result: DuelScore = { id: t.id, label: t.label, hit: true, score, reactionMs, distance };
    this.results.push(result);
    this.current = null;
    return result;
  }

  private miss(): void {
    if (!this.current) return;
    this.results.push({ id: this.current.id, label: this.current.label, hit: false, score: 0, reactionMs: null, distance: null });
    this.current = null;
  }

  stats(): DuelTargetStats {
    const hits = this.results.filter((r) => r.hit);
    let streak = 0;
    for (let i = this.results.length - 1; i >= 0 && this.results[i]!.hit; i--) streak++;
    return {
      last: this.results[this.results.length - 1] ?? null,
      average: hits.length ? Math.round(hits.reduce((s, r) => s + r.score, 0) / hits.length) : 0,
      averageAll: this.results.length ? Math.round(this.results.reduce((s, r) => s + r.score, 0) / this.results.length) : 0,
      accompanied: hits.length,
      total: this.results.length,
      streak,
      perfect: this.results.length > 0 && this.results.every((r) => r.hit && r.score >= DUEL_TARGET.PERFECT_MIN),
    };
  }
}
