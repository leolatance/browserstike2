import { describe, expect, it } from 'vitest';
import { CARDS, RARITY_DROP, card, cardText, cardValue, slotsForLevel } from '../src/data/cards';
import { weapon } from '../src/data/weapons';
import { buyForPlayer, freshInventory } from '../src/economy';
import { DUEL, duelScores, resolveDuel, type DuelContext, type Duelist } from '../src/duel';
import { effectiveAttrs, makePlayer, resolveBuild, setProgress, uniformAttrs, type Build, type PlayerClass } from '../src/player';
import { Rng } from '../src/rng';

describe('cards data (GDD 6)', () => {
  it('has 30 unique cards with the requested distribution', () => {
    expect(CARDS).toHaveLength(30);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(30);
    const byType = { flat: 0, conditional: 0, behavior: 0 };
    for (const c of CARDS) byType[c.type]++;
    expect(byType.flat).toBe(13);
    expect(byType.conditional).toBe(13);
    expect(byType.behavior).toBe(4);
    for (const c of CARDS) expect(c.id.startsWith('card_')).toBe(true);
  });

  it('tags: exactly 3 cards per class (a set needs 3 distinct cards)', () => {
    const perClass: Partial<Record<PlayerClass, number>> = {};
    for (const c of CARDS) if (c.tag) perClass[c.tag] = (perClass[c.tag] ?? 0) + 1;
    expect(Object.keys(perClass).sort()).toEqual(['anchor', 'awper', 'entry', 'igl', 'rifler', 'star', 'support']);
    for (const n of Object.values(perClass)) expect(n).toBe(3);
  });

  it('rarities cover all five tiers and the drop table sums to 100', () => {
    const tiers = new Set(CARDS.map((c) => c.rarity));
    expect([...tiers].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(Object.values(RARITY_DROP).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('levels scale ×1 / ×1.25 / ×1.5 (the GDD +4 → +5 → +6 ratio) and the text follows', () => {
    const c = card('card_aim_crosshair');
    expect([1, 2, 3].map((l) => cardValue(c, l as 1 | 2 | 3))).toEqual([18, 23, 27]);
    expect(cardText(c, 3)).toBe('+27 Mira');
    expect(cardValue(card('card_beh_save'), 3)).toBe(0);
  });

  it('slots by level follow GDD 6.3', () => {
    expect([0, 4, 5, 11, 12, 19, 20, 34, 35, 50].map(slotsForLevel)).toEqual([2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });
});

describe('build resolution', () => {
  const eq = (id: string, level: 1 | 2 | 3 = 1) => ({ id, level });

  it('flat cards add to effective attributes', () => {
    const p = makePlayer('p', 'p', 'rifler', uniformAttrs(50));
    p.build = { cards: [eq('card_aim_crosshair'), eq('card_aim_spray', 3)] };
    const e = effectiveAttrs(p, { mental: 50 });
    expect(e.mira).toBe(50 + cardValue(card('card_aim_crosshair'), 1) + cardValue(card('card_aim_spray'), 3));
    expect(e.mov).toBe(50);
  });

  it('duplicates do not stack; 3 same-tag cards activate the class', () => {
    const b: Build = { cards: [eq('card_aim_crosshair'), eq('card_aim_crosshair'), eq('card_aim_spray'), eq('card_cond_short_range')] };
    const r = resolveBuild(b);
    expect(r.flat.mira).toBe(36);
    expect(r.sets).toEqual(['rifler']);
    expect(r.activeClass).toBe('rifler');
    expect(setProgress(b)).toEqual({ rifler: 3 });
    const two: Build = { cards: [eq('card_move_jiggle'), eq('card_peek_wide')] };
    expect(resolveBuild(two).sets).toEqual([]);
    expect(resolveBuild(two).activeClass).toBe('rifler');
  });

  it('two complete sets = hybrid: first set is the played class, both bonuses apply', () => {
    const b: Build = {
      cards: [eq('card_move_jiggle'), eq('card_peek_wide'), eq('card_cond_first_contact'), eq('card_tac_reading'), eq('card_cond_retake_calm'), eq('card_beh_kit')],
    };
    const r = resolveBuild(b);
    expect(r.sets).toEqual(['entry', 'igl']);
    expect(r.activeClass).toBe('entry');
    expect(r.guaranteedTrade).toBe(true);
    expect(r.teamTatico).toBe(8);
    expect(r.behaviors.has('always_kit')).toBe(true);
  });

  it('AWPer set grants the AWP discount; Anchor set grants survival money', () => {
    expect(resolveBuild({ cards: [eq('card_move_strafe'), eq('card_cond_long_range'), eq('card_beh_scout')] }).behaviors.has('awp_discount')).toBe(true);
    expect(resolveBuild({ cards: [eq('card_tac_positioning'), eq('card_mental_calm'), eq('card_cond_site_anchor')] }).surviveMoney).toBe(200);
  });
});

describe('conditional cards in duels', () => {
  const ctx = (over: Partial<DuelContext> = {}): DuelContext => ({ range: 'mid', defenderHoldingAngle: false, inSmoke: false, retakeProT: null, numbersAdvantage: null, ...over });
  const duelist = (over: Partial<Duelist> = {}): Duelist => ({ attrs: uniformAttrs(50), weapon: weapon('ak47'), armor: true, hp: 100, clutch: false, ...over });

  it('fire only when the situation matches and are reported as triggered', () => {
    const prefire = resolveBuild({ cards: [{ id: 'card_cond_prefire', level: 1 }] }).conditionals;
    const base = duelScores(duelist(), duelist(), ctx()).scoreD;
    const off = duelScores(duelist(), duelist({ conditionals: prefire }), ctx());
    expect(off.scoreD).toBeCloseTo(base);
    expect(off.triggered.D).toEqual([]);
    const on = duelScores(duelist(), duelist({ conditionals: prefire }), ctx({ defenderHoldingAngle: true }));
    expect(on.scoreD).toBeCloseTo(base + DUEL.HOLD_ANGLE + DUEL.ATTR_SCALE * DUEL.W_MIRA * 36);
    expect(on.triggered.D).toEqual(['card_cond_prefire']);
    // Role-gated: the same card on the attacker never fires.
    expect(duelScores(duelist({ conditionals: prefire }), duelist(), ctx({ defenderHoldingAngle: true })).triggered.A).toEqual([]);
  });

  it('flags: trade / first duel / pistol / at site / numbers / range / clutch', () => {
    const with_ = (id: string) => resolveBuild({ cards: [{ id, level: 1 }] }).conditionals;
    const fires = (id: string, role: 'A' | 'D', c: DuelContext, d: Partial<Duelist> = {}) => {
      const a = role === 'A' ? duelist({ conditionals: with_(id), ...d }) : duelist();
      const dd = role === 'D' ? duelist({ conditionals: with_(id), ...d }) : duelist();
      return duelScores(a, dd, c).triggered[role].includes(id);
    };
    expect(fires('card_cond_trade_instinct', 'A', ctx({ attackerFlags: { trade: true } }))).toBe(true);
    expect(fires('card_cond_trade_instinct', 'A', ctx({ attackerFlags: { trade: false } }))).toBe(false);
    expect(fires('card_cond_first_contact', 'A', ctx({ attackerFlags: { firstDuel: true } }))).toBe(true);
    expect(fires('card_cond_pistol_hero', 'D', ctx({ defenderFlags: { pistol: true } }))).toBe(true);
    expect(fires('card_cond_site_anchor', 'D', ctx({ defenderFlags: { atSite: true } }))).toBe(true);
    expect(fires('card_cond_site_anchor', 'A', ctx({ attackerFlags: { atSite: true } }))).toBe(false);
    expect(fires('card_cond_numbers_down', 'A', ctx({ numbersAdvantage: 'D' }))).toBe(true);
    expect(fires('card_cond_star_pick', 'A', ctx({ numbersAdvantage: 'A' }))).toBe(true);
    expect(fires('card_cond_long_range', 'D', ctx({ range: 'long' }))).toBe(true);
    expect(fires('card_cond_long_range', 'D', ctx({ range: 'mid' }))).toBe(false);
    expect(fires('card_cond_clutch_nerves', 'D', ctx(), { clutch: true })).toBe(true);
    expect(fires('card_cond_retake_calm', 'A', ctx({ retakeProT: 'D' }))).toBe(true);
    expect(fires('card_cond_postplant', 'D', ctx({ retakeProT: 'D' }))).toBe(true);
    expect(fires('card_cond_flash_eyes', 'A', ctx({ attackerFlashedBy: 50 }))).toBe(true);
  });

  it('Star set adds raw score on the first duel; Anchor set raises site survival', () => {
    const star = resolveBuild({ cards: [{ id: 'card_aim_tap', level: 1 }, { id: 'card_mental_focus', level: 1 }, { id: 'card_cond_star_pick', level: 1 }] });
    const base = duelScores(duelist(), duelist(), ctx()).scoreA;
    const s = duelScores(duelist({ conditionals: star.conditionals }), duelist(), ctx({ attackerFlags: { firstDuel: true } }));
    expect(s.scoreA).toBeCloseTo(base + 6);
    expect(s.triggered.A).toContain('set:star');
    // Only duels the defender lost count (that's when the escape roll happens).
    const rng = new Rng(3);
    const rate = (siteSurvival: number) => {
      let lost = 0;
      let survived = 0;
      for (let i = 0; i < 20000; i++) {
        const r = resolveDuel(duelist(), duelist({ siteSurvival }), ctx({ defenderFlags: { atSite: true } }), rng);
        if (r.winner === 'A') {
          lost++;
          if (r.loserSurvived) survived++;
        }
      }
      return survived / lost;
    };
    expect(rate(0)).toBeCloseTo(0.175, 1);
    expect(rate(0.12)).toBeCloseTo(0.295, 1);
  });
});

describe('behaviour cards in the economy', () => {
  const inv = (side: 'CT' | 'T') => freshInventory(side);
  it('AWP discount lowers the price and the threshold', () => {
    const b = new Set(['awp_discount'] as const);
    const p = buyForPlayer({ side: 'CT', money: 5300, inv: inv('CT'), class: 'awper', decision: 'full', teamHasAwp: false, behaviors: b }, new Rng(1));
    expect(p.inv.weapon).toBe('awp');
    expect(p.spent).toBeLessThanOrEqual(5300);
    const q = buyForPlayer({ side: 'CT', money: 5300, inv: inv('CT'), class: 'awper', decision: 'full', teamHasAwp: false }, new Rng(1));
    expect(q.inv.weapon).not.toBe('awp');
  });
  it('Scout on the round after the pistol when it fits', () => {
    const b = new Set(['scout_round2'] as const);
    const p = buyForPlayer({ side: 'T', money: 3000, inv: inv('T'), class: 'rifler', decision: 'full', teamHasAwp: false, behaviors: b, afterPistol: true }, new Rng(1));
    expect(p.inv.weapon).toBe('scout');
    const q = buyForPlayer({ side: 'T', money: 3000, inv: inv('T'), class: 'rifler', decision: 'full', teamHasAwp: false, behaviors: b, afterPistol: false }, new Rng(1));
    expect(q.inv.weapon).not.toBe('scout');
  });
  it('Kit sempre buys the kit first as CT', () => {
    const b = new Set(['always_kit'] as const);
    const p = buyForPlayer({ side: 'CT', money: 2500, inv: inv('CT'), class: 'entry', decision: 'force', teamHasAwp: false, behaviors: b }, new Rng(1));
    expect(p.inv.kit).toBe(true);
  });
});
