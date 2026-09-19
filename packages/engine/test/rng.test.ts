import { describe, expect, it } from 'vitest';
import { Rng } from '../src/rng';

describe('Rng (mulberry32)', () => {
  it('same seed → same sequence', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const sa = Array.from({ length: 1000 }, () => a.next());
    const sb = Array.from({ length: 1000 }, () => b.next());
    expect(sa).toEqual(sb);
  });

  it('different seeds → different sequences', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const sa = Array.from({ length: 50 }, () => a.next());
    const sb = Array.from({ length: 50 }, () => b.next());
    expect(sa).not.toEqual(sb);
  });

  it('next() stays in [0, 1) and looks uniform', () => {
    const rng = new Rng(7);
    let sum = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / n).toBeCloseTo(0.5, 2);
  });

  it('int(min,max) is inclusive on both ends and covers the range', () => {
    const rng = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) {
      const v = rng.int(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2, 3]);
  });

  it('chance(p) approximates p', () => {
    const rng = new Rng(99);
    let hits = 0;
    for (let i = 0; i < 50_000; i++) if (rng.chance(0.3)) hits++;
    expect(hits / 50_000).toBeCloseTo(0.3, 1);
    expect(new Rng(1).chance(0)).toBe(false);
    expect(new Rng(1).chance(1)).toBe(true);
  });

  it('pick() only returns members; shuffle() is a permutation and does not mutate', () => {
    const rng = new Rng(5);
    const arr = [1, 2, 3, 4, 5];
    for (let i = 0; i < 100; i++) expect(arr).toContain(rng.pick(arr));
    const shuffled = rng.shuffle(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(new Rng(5).shuffle(arr)).toEqual(new Rng(5).shuffle(arr));
  });

  it('fork() is deterministic', () => {
    const a = new Rng(11).fork();
    const b = new Rng(11).fork();
    expect(a.next()).toBe(b.next());
  });
});
