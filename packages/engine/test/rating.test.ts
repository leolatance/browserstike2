import { describe, expect, it } from 'vitest';
import { RATING, displayRating, impact, matchRating, ratingBreakdown } from '../src/rating';

describe('rating (GDD 8.2)', () => {
  it('reproduces the formula for a hand-computed line', () => {
    // 24 rounds: 18 kills, 16 deaths, 4 assists, 1800 damage, 17 KAST rounds
    const input = { kills: 18, deaths: 16, assists: 4, damage: 1800, kastRounds: 17, rounds: 24 };
    const kpr = 18 / 24;
    const dpr = 16 / 24;
    const apr = 4 / 24;
    const adr = 1800 / 24;
    const kast = (17 / 24) * 100;
    const imp = 2.13 * kpr + 0.42 * apr - 0.41;
    const expected = 0.0073 * kast + 0.3591 * kpr - 0.5329 * dpr + 0.2372 * imp + 0.0032 * adr + 0.1587;
    expect(impact(kpr, apr)).toBeCloseTo(imp, 6);
    expect(matchRating(input)).toBeCloseTo(expected, 6);
    const b = ratingBreakdown(input);
    expect(b.kpr).toBeCloseTo(kpr);
    expect(b.kast).toBeCloseTo(kast);
  });

  it('more kills → higher; more deaths → lower; never negative', () => {
    const base = { kills: 15, deaths: 15, assists: 3, damage: 1500, kastRounds: 16, rounds: 24 };
    expect(matchRating({ ...base, kills: 25 })).toBeGreaterThan(matchRating(base));
    expect(matchRating({ ...base, deaths: 24 })).toBeLessThan(matchRating(base));
    expect(matchRating({ kills: 0, deaths: 24, assists: 0, damage: 0, kastRounds: 0, rounds: 24 })).toBe(0);
  });

  it('handles zero rounds without NaN', () => {
    expect(Number.isFinite(matchRating({ kills: 0, deaths: 0, assists: 0, damage: 0, kastRounds: 0, rounds: 0 }))).toBe(true);
  });

  it('displayRating rounds to 2 decimals', () => {
    expect(displayRating(1.23456)).toBe(1.23);
    expect(RATING.CONST).toBeTypeOf('number');
  });
});
