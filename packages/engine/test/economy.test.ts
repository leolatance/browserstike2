import { describe, expect, it } from 'vitest';
import {
  buyForPlayer,
  decideTeamBuy,
  freshInventory,
  fullBuyFloor,
  lossBonus,
  nextLossStreak,
  roundIncome,
  type Inventory,
} from '../src/economy';
import { Rng } from '../src/rng';
import { weapon } from '../src/data/weapons';

const inv = (side: 'CT' | 'T', over: Partial<Inventory> = {}): Inventory => ({ ...freshInventory(side), ...over });

describe('economy.income', () => {
  it('loss bonus climbs 1400 → 3400 and caps', () => {
    expect([1, 2, 3, 4, 5, 6].map(lossBonus)).toEqual([1400, 1900, 2400, 2900, 3400, 3400]);
  });

  it('loss streak: +1 on loss, −1 on win (CS2)', () => {
    expect(nextLossStreak(0, false)).toBe(1);
    expect(nextLossStreak(3, true)).toBe(2);
    expect(nextLossStreak(0, true)).toBe(0);
  });

  it('winners get 3250 / 3500, losers get loss bonus (+800 if planted)', () => {
    expect(roundIncome({ won: true, side: 'CT', reason: 'elimination', planted: false, alive: true, lossStreak: 0 })).toBe(3250);
    expect(roundIncome({ won: true, side: 'T', reason: 'bomb', planted: true, alive: false, lossStreak: 0 })).toBe(3500);
    expect(roundIncome({ won: true, side: 'CT', reason: 'defuse', planted: true, alive: true, lossStreak: 0 })).toBe(3500);
    expect(roundIncome({ won: false, side: 'CT', reason: 'bomb', planted: true, alive: false, lossStreak: 1 })).toBe(1400);
    expect(roundIncome({ won: false, side: 'T', reason: 'defuse', planted: true, alive: false, lossStreak: 2 })).toBe(1900 + 800);
    expect(roundIncome({ won: false, side: 'T', reason: 'time', planted: false, alive: true, lossStreak: 1 })).toBe(0);
    expect(roundIncome({ won: false, side: 'T', reason: 'time', planted: false, alive: false, lossStreak: 1 })).toBe(1400);
  });
});

describe('economy.decideTeamBuy', () => {
  const five = (money: number, side: 'CT' | 'T' = 'T') => Array.from({ length: 5 }, () => ({ money, inv: inv(side) }));

  it('pistol rounds are always pistol', () => {
    expect(decideTeamBuy({ side: 'T', players: five(800), lossStreak: 0, tatico: 0, pistol: true }, new Rng(1))).toBe('pistol');
  });

  it('with perfect Tático: full / force / eco follow the GDD rules', () => {
    const rng = new Rng(1);
    expect(decideTeamBuy({ side: 'T', players: five(fullBuyFloor('T')), lossStreak: 0, tatico: 100, pistol: false }, rng)).toBe('full');
    expect(decideTeamBuy({ side: 'T', players: five(2100), lossStreak: 2, tatico: 100, pistol: false }, rng)).toBe('force');
    expect(decideTeamBuy({ side: 'T', players: five(2100), lossStreak: 1, tatico: 100, pistol: false }, rng)).toBe('eco');
    expect(decideTeamBuy({ side: 'T', players: five(1400), lossStreak: 3, tatico: 100, pistol: false }, rng)).toBe('eco');
    // Saved rifles count as "can buy".
    const saved = five(500).map((p) => ({ ...p, inv: inv('T', { weapon: 'ak47' }) }));
    expect(decideTeamBuy({ side: 'T', players: saved, lossStreak: 0, tatico: 100, pistol: false }, rng)).toBe('full');
  });

  it('Tático 0 is wrong about half the time, and a wrong call is the neighbouring option', () => {
    const rng = new Rng(7);
    let wrong = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const d = decideTeamBuy({ side: 'CT', players: five(6000, 'CT'), lossStreak: 0, tatico: 0, pistol: false }, rng);
      if (d !== 'full') wrong++;
      expect(d).not.toBe('eco');
    }
    expect(wrong / n).toBeGreaterThan(0.45);
    expect(wrong / n).toBeLessThan(0.55);
  });
});

describe('economy.buyForPlayer', () => {
  it('AWPer with ≥ $5750 buys AWP + helmet, unless a teammate has one', () => {
    const p = buyForPlayer({ side: 'CT', money: 6000, inv: inv('CT'), class: 'awper', decision: 'full', teamHasAwp: false }, new Rng(1));
    expect(p.inv.weapon).toBe('awp');
    expect(p.inv.helmet).toBe(true);
    expect(p.spent).toBeGreaterThanOrEqual(5750);
    const q = buyForPlayer({ side: 'CT', money: 6000, inv: inv('CT'), class: 'awper', decision: 'full', teamHasAwp: true }, new Rng(1));
    expect(weapon(q.inv.weapon).class).toBe('rifle');
  });

  it('Rifler picks the best rifle that leaves $1000 of reserve', () => {
    const rich = buyForPlayer({ side: 'T', money: 8000, inv: inv('T'), class: 'rifler', decision: 'full', teamHasAwp: false }, new Rng(1));
    expect(rich.inv.weapon).toBe('ak47');
    expect(rich.inv.helmet).toBe(true);
    expect(8000 - rich.spent).toBeGreaterThanOrEqual(1000);
    const tight = buyForPlayer({ side: 'T', money: 4000, inv: inv('T'), class: 'rifler', decision: 'full', teamHasAwp: false }, new Rng(1));
    expect(tight.inv.weapon).toBe('galil');
    expect(tight.inv.armor).toBe(true);
    expect(4000 - tight.spent).toBeGreaterThanOrEqual(1000 - 500); // utility may dip into half the reserve
  });

  it('Support buys utility first', () => {
    const p = buyForPlayer({ side: 'T', money: 5000, inv: inv('T'), class: 'support', decision: 'full', teamHasAwp: false }, new Rng(1));
    expect(p.inv.utils).toContain('smoke');
    expect(p.inv.utils.filter((u) => u === 'flash')).toHaveLength(2);
    expect(p.inv.armor).toBe(true);
  });

  it('eco keeps the money; force spends it', () => {
    const eco = buyForPlayer({ side: 'CT', money: 1000, inv: inv('CT'), class: 'rifler', decision: 'eco', teamHasAwp: false }, new Rng(1));
    expect(eco.spent).toBe(0);
    const force = buyForPlayer({ side: 'CT', money: 2400, inv: inv('CT'), class: 'rifler', decision: 'force', teamHasAwp: false }, new Rng(1));
    expect(force.inv.armor).toBe(true);
    expect(['mp9', 'famas']).toContain(force.inv.weapon);
  });

  it('pistol round spends at most $800 and never exceeds money', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 200; i++) {
      const p = buyForPlayer({ side: i % 2 ? 'T' : 'CT', money: 800, inv: inv(i % 2 ? 'T' : 'CT'), class: 'rifler', decision: 'pistol', teamHasAwp: false }, rng);
      expect(p.spent).toBeLessThanOrEqual(800);
      expect(p.spent).toBeGreaterThan(0);
    }
  });

  it('a saved rifle is kept and only armor/utility is bought', () => {
    const p = buyForPlayer({ side: 'T', money: 3000, inv: inv('T', { weapon: 'ak47' }), class: 'rifler', decision: 'full', teamHasAwp: false }, new Rng(1));
    expect(p.inv.weapon).toBe('ak47');
    expect(p.inv.armor).toBe(true);
    expect(p.spent).toBeLessThan(2700);
  });
});
