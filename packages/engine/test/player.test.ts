import { describe, expect, it } from 'vitest';
import {
  averageAttr,
  effectiveAttrs,
  findIgl,
  initialMental,
  makePlayer,
  mentalMultiplier,
  uniformAttrs,
  type Team,
} from '../src/player';

const base = makePlayer('p1', 'tester', 'rifler', { mira: 60, mov: 50, peek: 40, tatico: 70, util: 30, mental: 50 });

describe('player.effectiveAttrs', () => {
  it('mental 50 is neutral (×1.0)', () => {
    expect(mentalMultiplier(50)).toBeCloseTo(1);
    const e = effectiveAttrs(base, { mental: 50 });
    expect(e).toEqual({ mira: 60, mov: 50, peek: 40, tatico: 70, util: 30, mental: 50 });
  });

  it('mental scales the other five between ×0.9 and ×1.1', () => {
    expect(mentalMultiplier(0)).toBeCloseTo(0.9);
    expect(mentalMultiplier(100)).toBeCloseTo(1.1);
    const low = effectiveAttrs(base, { mental: 0 });
    expect(low.mira).toBeCloseTo(54);
    expect(low.mental).toBe(0);
    const high = effectiveAttrs(base, { mental: 100 });
    expect(high.mira).toBeCloseTo(66);
  });

  it('floors at 0; no upper clamp in the sim (100 is a display cap)', () => {
    const god = makePlayer('g', 'god', 'star', uniformAttrs(100));
    const e = effectiveAttrs(god, { mental: 100 });
    expect(e.mira).toBeCloseTo(110);
    const neg = makePlayer('n', 'neg', 'star', uniformAttrs(-20));
    expect(effectiveAttrs(neg, { mental: 150 }).mira).toBe(0);
    expect(effectiveAttrs(neg, { mental: 150 }).mental).toBe(100);
  });

  it('team without IGL loses 15% Tático', () => {
    expect(effectiveAttrs(base, { mental: 50, noIgl: true }).tatico).toBeCloseTo(70 * 0.85);
  });

  it('build hook: flat cards add, unknown cards throw', () => {
    const withCards = { ...base, build: { cards: [{ id: 'card_peek_timing', level: 2 as const }] } };
    expect(effectiveAttrs(withCards, { mental: 50 }).peek).toBe(base.attrs.peek + 23);
    expect(() => effectiveAttrs({ ...base, build: { cards: [{ id: 'nope', level: 1 as const }] } }, { mental: 50 })).toThrow();
  });

  it('initialMental applies form clamped to 0.85–1.15', () => {
    expect(initialMental({ ...base, form: 1.0 })).toBe(50);
    expect(initialMental({ ...base, form: 2.0 })).toBeCloseTo(57.5);
    expect(initialMental({ ...base, form: 0.1 })).toBeCloseTo(42.5);
    expect(initialMental(base)).toBe(50);
  });

  it('helpers', () => {
    expect(averageAttr(base.attrs)).toBeCloseTo(50);
    const team: Team = { id: 't', name: 'T', players: [base, makePlayer('i', 'igl', 'igl', uniformAttrs(50))] };
    expect(findIgl(team)?.id).toBe('i');
  });
});
