import { describe, expect, it } from 'vitest';
import { MMR, RANKS, expectedScore, mmrDelta, rankOf, softReset } from '../src/mmr';

describe('mmr (GDD 8.3)', () => {
  it('Elo expectation and K=25 with damping', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.7);
    expect(mmrDelta(true, 0.5, 1.0)).toBe(Math.round(MMR.K * 0.5));
    // Carry loses less, carried gains less.
    expect(mmrDelta(false, 0.5, 1.5)).toBeGreaterThan(mmrDelta(false, 0.5, 0.7));
    expect(mmrDelta(true, 0.5, 0.7)).toBeLessThan(mmrDelta(true, 0.5, 1.5));
    expect(mmrDelta(true, 0.5, 2.0)).toBe(Math.round(MMR.K * 0.5 * 1.4));
  });
  it('10 tiers, monotonic, soft reset halves the distance to 1000', () => {
    expect(RANKS).toHaveLength(10);
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i]!.min).toBeGreaterThan(RANKS[i - 1]!.min);
    expect(rankOf(0).tier).toBe(1);
    expect(rankOf(1000).name).toBe('Guarda');
    expect(rankOf(5000).tier).toBe(10);
    expect(softReset(1400)).toBe(1200);
    expect(softReset(600)).toBe(800);
  });
});
