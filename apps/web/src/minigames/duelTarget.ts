/**
 * Minigame #1 — "Alvo de duelo" (GDD 10.1). Pure logic, no DOM.
 * A target appears when the player's character enters a duel; hitting it fast
 * and centred scores 0–100. The result NEVER feeds back into the simulation.
 */
import { Rng } from '@idle-strike/engine';

export const DUEL_TARGET = {
  VISIBLE_MS: 900,
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
  spawn(id: string, nowMs: number, label: string | null = null): Target {
    if (this.current) this.miss();
    const rng = new Rng(hashSeed(id));
    const m = DUEL_TARGET.MARGIN;
    this.current = { id, label, x: m + rng.next() * (1 - 2 * m), y: m + rng.next() * (1 - 2 * m), spawnedAt: nowMs };
    return this.current;
  }

  /** Expire the target when its window is over. Returns true if it just expired. */
  tick(nowMs: number): boolean {
    if (this.current && nowMs - this.current.spawnedAt >= this.visibleMs) {
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
    const reactionMs = nowMs - this.current.spawnedAt;
    const inside = distance < 1;
    const result: DuelScore = {
      id: this.current.id,
      label: this.current.label,
      hit: true,
      score: inside ? scoreFor(reactionMs, distance, this.visibleMs) : 0,
      reactionMs,
      distance,
    };
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
