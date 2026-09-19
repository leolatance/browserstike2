import { describe, expect, it } from 'vitest';
import { weapon } from '../src/data/weapons';
import { DUEL, duelScores, resolveDuel, tradeChance, winProbability, type DuelContext, type Duelist } from '../src/duel';
import { uniformAttrs } from '../src/player';
import { Rng } from '../src/rng';

const ctx = (over: Partial<DuelContext> = {}): DuelContext => ({
  range: 'mid',
  defenderHoldingAngle: false,
  inSmoke: false,
  retakeProT: null,
  numbersAdvantage: null,
  ...over,
});

const duelist = (v: number, over: Partial<Duelist> = {}): Duelist => ({
  attrs: uniformAttrs(v),
  weapon: weapon('ak47'),
  armor: true,
  hp: 100,
  clutch: false,
  ...over,
});

function winRate(a: Duelist, d: Duelist, c: DuelContext, n = 20000): number {
  const rng = new Rng(123);
  let w = 0;
  for (let i = 0; i < n; i++) if (resolveDuel(a, d, c, rng).winner === 'A') w++;
  return w / n;
}

describe('duel', () => {
  it('equal duelists, neutral context → 50%', () => {
    const { scoreA, scoreD } = duelScores(duelist(50), duelist(50), ctx());
    expect(scoreA).toBeCloseTo(scoreD);
    expect(winProbability(scoreA, scoreD)).toBeCloseTo(0.5);
    expect(winRate(duelist(50), duelist(50), ctx())).toBeCloseTo(0.5, 1);
  });

  it('logistic follows the GDD shape (10 points of score ≈ 64%)', () => {
    expect(winProbability(10, 0)).toBeCloseTo(1 / (1 + Math.pow(10, -10 / DUEL.LOGISTIC_DIVISOR)));
    expect(winProbability(0, 10)).toBeCloseTo(1 - winProbability(10, 0));
  });

  it('better attributes win more; empirical rate matches pWin', () => {
    const a = duelist(70);
    const d = duelist(50);
    const p = resolveDuel(a, d, ctx(), new Rng(1)).pWin;
    expect(p).toBeGreaterThan(0.5);
    expect(winRate(a, d, ctx())).toBeCloseTo(p, 1);
  });

  it('situational modifiers point the right way', () => {
    const base = duelScores(duelist(50), duelist(50), ctx());
    expect(duelScores(duelist(50), duelist(50), ctx({ defenderHoldingAngle: true })).scoreD).toBeCloseTo(base.scoreD + DUEL.HOLD_ANGLE);
    expect(duelScores(duelist(50), duelist(50), ctx({ attackerFlashedBy: 100 })).scoreA).toBeCloseTo(base.scoreA - DUEL.FLASH_PENALTY);
    expect(duelScores(duelist(50), duelist(50), ctx({ attackerFlashedBy: 50 })).scoreA).toBeCloseTo(base.scoreA - DUEL.FLASH_PENALTY / 2);
    expect(duelScores(duelist(50), duelist(50), ctx({ retakeProT: 'D' })).scoreD).toBeCloseTo(base.scoreD + DUEL.RETAKE_PRO_T);
    expect(duelScores(duelist(50), duelist(50), ctx({ numbersAdvantage: 'A' })).scoreA).toBeCloseTo(base.scoreA + DUEL.NUMBERS);
    const smoke = duelScores(duelist(50), duelist(50), ctx({ inSmoke: true }));
    expect(smoke.scoreA).toBeCloseTo(base.scoreA + DUEL.SMOKE_PENALTY);
    expect(smoke.scoreD).toBeCloseTo(base.scoreD + DUEL.SMOKE_PENALTY);
    expect(duelScores(duelist(50, { armor: false }), duelist(50), ctx()).scoreA).toBeCloseTo(base.scoreA + DUEL.NO_ARMOR);
    expect(duelScores(duelist(50, { hp: 50 }), duelist(50), ctx()).scoreA).toBeCloseTo(base.scoreA - 50 * DUEL.HP_PENALTY_PER_POINT);
  });

  it('weapons apply range modifiers (AWP long vs short; pistol vs rifle)', () => {
    const awp = duelist(50, { weapon: weapon('awp') });
    const ak = duelist(50);
    expect(duelScores(awp, ak, ctx({ range: 'long' })).scoreA - duelScores(ak, ak, ctx({ range: 'long' })).scoreA).toBe(18);
    expect(duelScores(awp, ak, ctx({ range: 'short' })).scoreA - duelScores(ak, ak, ctx({ range: 'short' })).scoreA).toBe(-10);
    const pistol = duelist(50, { weapon: weapon('glock'), armor: false });
    expect(winRate(pistol, ak, ctx())).toBeLessThan(0.35);
  });

  it('clutch swaps Tático for Mental and adds 0.2·mental', () => {
    const d = duelist(50, { attrs: { ...uniformAttrs(50), tatico: 10, mental: 90 } });
    const normal = duelScores(duelist(50), { ...d, clutch: false }, ctx()).scoreD;
    const clutch = duelScores(duelist(50), { ...d, clutch: true }, ctx()).scoreD;
    expect(clutch).toBeCloseTo(normal + DUEL.ATTR_SCALE * (DUEL.W_TATICO * (90 - 10) + DUEL.CLUTCH_MENTAL * 90));
  });

  it('headshot and retreat rates scale with Mira and Mov', () => {
    const rng = new Rng(9);
    let hsHi = 0;
    let hsLo = 0;
    let retreatHi = 0;
    let retreatLo = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      // Winner with Mira 100 vs winner with Mira 0 (mirror duels so the winner's attrs are known).
      if (resolveDuel(duelist(100), duelist(100), ctx(), rng).headshot) hsHi++;
      if (resolveDuel(duelist(0), duelist(0), ctx(), rng).headshot) hsLo++;
      // Loser with Mov 100 vs loser with Mov 0.
      if (resolveDuel(duelist(100), duelist(100), ctx(), rng).loserSurvived) retreatHi++;
      if (resolveDuel(duelist(0), duelist(0), ctx(), rng).loserSurvived) retreatLo++;
    }
    expect(hsHi / n).toBeCloseTo(0.75, 1);
    expect(hsLo / n).toBeCloseTo(0.25, 1);
    expect(retreatHi / n).toBeCloseTo(0.3, 1);
    expect(retreatLo / n).toBeCloseTo(0.05, 1);
  });

  it('killed loser takes exactly its HP; survivor takes less than its HP', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 2000; i++) {
      const hp = rng.int(1, 100);
      const r = resolveDuel(duelist(50, { hp }), duelist(50, { hp }), ctx(), rng);
      if (r.loserSurvived) {
        expect(r.damage).toBeLessThan(hp);
        expect(hp).toBeGreaterThan(DUEL.RETREAT_MIN_HP);
      } else expect(r.damage).toBe(hp);
    }
  });

  it('trade chance follows 0.3 + 0.4·peek/100', () => {
    expect(tradeChance(0)).toBeCloseTo(0.3);
    expect(tradeChance(100)).toBeCloseTo(0.7);
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const rng = new Rng(77);
      return Array.from({ length: 50 }, () => resolveDuel(duelist(55), duelist(45), ctx(), rng));
    };
    expect(run()).toEqual(run());
  });
});
