/**
 * Duel resolution (GDD 5.5). Attacker **A** initiates; defender **D** holds.
 * Every tunable lives in `DUEL` and is marked [v0]; balance tests own them.
 */
import type { Range, Weapon } from './data/weapons';
import { NO_ARMOR_PENALTY } from './data/weapons';
import type { Attrs } from './player';
import type { Rng } from './rng';

export const DUEL = {
  /**
   * Multiplies the attribute part of the score. [v0 → v1] The GDD formula
   * (weights summing to 1.0 with divisor 40) makes +10 in every attribute win
   * ~64% of duels, which compounds to >95% of matches. Attributes must be a
   * smooth edge, weapons/situation the loud one. Tuned via balance.test.ts.
   */
  ATTR_SCALE: 1.0, // [v0]
  /** Logistic divisor: P(A) = 1 / (1 + 10^((scoreD − scoreA) / DIVISOR)). */
  LOGISTIC_DIVISOR: 40, // [v0]

  W_MIRA: 0.45, // [v0]
  W_PEEK: 0.25, // [v0]  attacker
  W_TATICO: 0.25, // [v0] defender (position)
  W_MOV: 0.15, // [v0]
  W_UTIL: 0.15, // [v0]

  HOLD_ANGLE: 6, // [v0] defender holding an angle
  FLASH_PENALTY: 15, // [v0] −15 · (enemy util / 100) when flashed
  SMOKE_PENALTY: -10, // [v0] both sides when the duel happens in smoke
  RETAKE_PRO_T: 5, // [v0] T defending a planted bomb
  NUMBERS: 8, // [v0] side with the numeric advantage
  NO_ARMOR: NO_ARMOR_PENALTY, // [v0] −8
  HP_PENALTY_PER_POINT: 0.08, // [v0] −0.08 per missing HP point

  HS_BASE: 0.25, // [v0] P(headshot | win) = 0.25 + 0.5 · mira/100
  HS_MIRA: 0.5, // [v0]
  RETREAT_BASE: 0.05, // [v0] P(loser survives) = 0.05 + 0.25 · mov/100
  RETREAT_MOV: 0.25, // [v0]
  RETREAT_MIN_HP: 25, // [v0] below this HP the loser cannot escape
  TRADE_BASE: 0.3, // [v0] P(trade in 3s) = 0.3 + 0.4 · peek/100
  TRADE_PEEK: 0.4, // [v0]
  CLUTCH_MENTAL: 0.2, // [v0] +0.2 · mental for the clutcher
};

export interface Duelist {
  /** Effective attributes at duel time (already clamped). */
  attrs: Attrs;
  weapon: Weapon;
  armor: boolean;
  hp: number;
  /** This player is alone against ≥ 2 enemies. */
  clutch: boolean;
}

export interface DuelContext {
  range: Range;
  defenderHoldingAngle: boolean;
  /** Util attribute of the enemy who flashed the attacker, if any. */
  attackerFlashedBy?: number;
  /** Util attribute of the enemy who flashed the defender, if any. */
  defenderFlashedBy?: number;
  inSmoke: boolean;
  /** Which side is the T defending a planted bomb (gets +5), if any. */
  retakeProT: 'A' | 'D' | null;
  /** Side with more players in the fight, if any. */
  numbersAdvantage: 'A' | 'D' | null;
}

export interface DuelResult {
  winner: 'A' | 'D';
  /** P(A wins) that was rolled against. */
  pWin: number;
  headshot: boolean;
  /** Loser escaped with damage instead of dying. */
  loserSurvived: boolean;
  /** Damage dealt to the loser (equals loser HP when killed). */
  damage: number;
}

function attrPart(d: Duelist, role: 'A' | 'D'): number {
  const a = d.attrs;
  const positional = role === 'A' ? DUEL.W_PEEK * a.peek : DUEL.W_TATICO * (d.clutch ? a.mental : a.tatico);
  let score = DUEL.W_MIRA * a.mira + positional + DUEL.W_MOV * a.mov + DUEL.W_UTIL * a.util;
  if (d.clutch) score += DUEL.CLUTCH_MENTAL * a.mental;
  return DUEL.ATTR_SCALE * score;
}

function commonPart(d: Duelist, ctx: DuelContext): number {
  let s = d.weapon.rangeMod[ctx.range];
  if (!d.armor) s += DUEL.NO_ARMOR;
  s -= DUEL.HP_PENALTY_PER_POINT * (100 - d.hp);
  if (ctx.inSmoke) s += DUEL.SMOKE_PENALTY;
  return s;
}

export function duelScores(a: Duelist, d: Duelist, ctx: DuelContext): { scoreA: number; scoreD: number } {
  let scoreA = attrPart(a, 'A') + commonPart(a, ctx);
  let scoreD = attrPart(d, 'D') + commonPart(d, ctx);
  if (ctx.defenderHoldingAngle) scoreD += DUEL.HOLD_ANGLE;
  if (ctx.attackerFlashedBy !== undefined) scoreA -= DUEL.FLASH_PENALTY * (ctx.attackerFlashedBy / 100);
  if (ctx.defenderFlashedBy !== undefined) scoreD -= DUEL.FLASH_PENALTY * (ctx.defenderFlashedBy / 100);
  if (ctx.retakeProT === 'A') scoreA += DUEL.RETAKE_PRO_T;
  if (ctx.retakeProT === 'D') scoreD += DUEL.RETAKE_PRO_T;
  if (ctx.numbersAdvantage === 'A') scoreA += DUEL.NUMBERS;
  if (ctx.numbersAdvantage === 'D') scoreD += DUEL.NUMBERS;
  return { scoreA, scoreD };
}

/** P(A wins) from the two scores. */
export function winProbability(scoreA: number, scoreD: number): number {
  return 1 / (1 + Math.pow(10, (scoreD - scoreA) / DUEL.LOGISTIC_DIVISOR));
}

export function headshotChance(mira: number): number {
  return DUEL.HS_BASE + DUEL.HS_MIRA * (mira / 100);
}

export function retreatChance(mov: number): number {
  return DUEL.RETREAT_BASE + DUEL.RETREAT_MOV * (mov / 100);
}

/** P(a teammate trades the kill within 3s), from the next ally's Peek. */
export function tradeChance(nextAllyPeek: number): number {
  return DUEL.TRADE_BASE + DUEL.TRADE_PEEK * (nextAllyPeek / 100);
}

export function resolveDuel(a: Duelist, d: Duelist, ctx: DuelContext, rng: Rng): DuelResult {
  const { scoreA, scoreD } = duelScores(a, d, ctx);
  const pWin = winProbability(scoreA, scoreD);
  const aWins = rng.chance(pWin);
  const winner = aWins ? a : d;
  const loser = aWins ? d : a;

  const headshot = rng.chance(headshotChance(winner.attrs.mira));
  const canRetreat = loser.hp > DUEL.RETREAT_MIN_HP;
  const loserSurvived = canRetreat && rng.chance(retreatChance(loser.attrs.mov));
  const damage = loserSurvived ? Math.min(loser.hp - 1, rng.int(20, 70)) : loser.hp;

  return { winner: aWins ? 'A' : 'D', pWin, headshot, loserSurvived, damage };
}
