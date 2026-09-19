/**
 * Economy (GDD 5.4): round income, loss bonus, team buy decision and
 * individual purchases. Values are CS-like and marked [v0].
 */
import type { BuyType, RoundEndReason, Side } from './events';
import { GEAR, riflesFor, smgFor, starterPistol, weapon, type UtilId, type Weapon } from './data/weapons';
import type { PlayerClass } from './player';
import type { Rng } from './rng';

export const START_MONEY = 800; // [v0]
export const OT_START_MONEY = 10_000; // [v0]
export const MAX_MONEY = 16_000; // [v0]
export const WIN_REWARD = 3250; // [v0] elimination / time
export const WIN_REWARD_OBJECTIVE = 3500; // [v0] bomb exploded / defused
export const LOSS_BONUS = [1400, 1900, 2400, 2900, 3400] as const; // [v0]
export const PLANT_BONUS = 800; // [v0] each T when the bomb was planted and the round was lost

export interface Inventory {
  weapon: string;
  armor: boolean;
  helmet: boolean;
  kit: boolean;
  utils: UtilId[];
}

export function freshInventory(side: Side): Inventory {
  return { weapon: starterPistol(side).id, armor: false, helmet: false, kit: false, utils: [] };
}

/** Loss bonus for a team whose loss streak (after this loss) is `streak`. */
export function lossBonus(streak: number): number {
  const i = Math.max(1, Math.min(streak, LOSS_BONUS.length)) - 1;
  return LOSS_BONUS[i] as number;
}

/** CS2 rule: a win decrements the loss streak by one instead of resetting it. */
export function nextLossStreak(current: number, won: boolean): number {
  return won ? Math.max(0, current - 1) : current + 1;
}

export interface IncomeParams {
  won: boolean;
  side: Side;
  reason: RoundEndReason;
  /** Bomb was planted this round. */
  planted: boolean;
  /** Player was alive at round end. */
  alive: boolean;
  /** Team loss streak already updated for this round. */
  lossStreak: number;
}

/** Money a player receives at round end (kill rewards are paid during the round). */
export function roundIncome(p: IncomeParams): number {
  if (p.won) return p.reason === 'bomb' || p.reason === 'defuse' ? WIN_REWARD_OBJECTIVE : WIN_REWARD;
  // Ts alive when the clock runs out get nothing (they didn't try).
  if (p.side === 'T' && p.reason === 'time' && p.alive) return 0;
  let income = lossBonus(p.lossStreak);
  if (p.side === 'T' && p.planted) income += PLANT_BONUS;
  return income;
}

export function addMoney(current: number, delta: number): number {
  return Math.max(0, Math.min(MAX_MONEY, current + delta));
}

// ---------------------------------------------------------------------------
// Team decision
// ---------------------------------------------------------------------------

/** Cheapest rifle + kevlar for the side: the floor for "everyone can buy". [v0] */
export function fullBuyFloor(side: Side): number {
  const cheapest = riflesFor(side)[0] as Weapon;
  return cheapest.price + GEAR.kevlar;
}

export const FORCE_AVG_MONEY = 2000; // [v0]
export const FORCE_MIN_LOSS_STREAK = 2; // [v0]

export const ECON = {
  /** P(wrong team buy) = (100 − tatico) / BUY_MISTAKE_DIVISOR. GDD 5.4: 200. */
  BUY_MISTAKE_DIVISOR: 200, // [v0]
  /** Eco purchases: full save below ECO_P250_MONEY. [v1] */
  ECO_P250_MONEY: 1500,
  ECO_DEAGLE_MONEY: 2400,
};

export interface TeamBuyInput {
  side: Side;
  players: { money: number; inv: Inventory }[];
  lossStreak: number;
  /** Effective Tático of the IGL (or team average without one). */
  tatico: number;
  pistol: boolean;
}

/**
 * GDD 5.4: full if everyone can buy rifle+armor; force if avg ≥ $2000 and
 * loss streak ≥ 2; otherwise eco. Low Tático makes the wrong call with
 * probability (100 − tatico) / 200.
 */
export function decideTeamBuy(input: TeamBuyInput, rng: Rng): BuyType {
  if (input.pistol) return 'pistol';
  const floor = fullBuyFloor(input.side);
  const everyoneCan = input.players.every((p) => hasRifleClass(p.inv) || p.money >= floor);
  const avg = input.players.reduce((s, p) => s + p.money, 0) / Math.max(1, input.players.length);
  let decision: BuyType;
  if (everyoneCan) decision = 'full';
  else if (avg >= FORCE_AVG_MONEY && input.lossStreak >= FORCE_MIN_LOSS_STREAK) decision = 'force';
  else decision = 'eco';

  const mistake = (100 - input.tatico) / ECON.BUY_MISTAKE_DIVISOR;
  if (rng.chance(mistake)) {
    // [v1] A wrong call lands on the neighbouring option (full↔force↔eco):
    // nobody with $4000 each "accidentally" saves.
    if (decision === 'force') decision = rng.pick(['full', 'eco'] as BuyType[]);
    else decision = 'force';
  }
  return decision;
}

export function hasRifleClass(inv: Inventory): boolean {
  const c = weapon(inv.weapon).class;
  return c === 'rifle' || c === 'awp';
}

// ---------------------------------------------------------------------------
// Individual purchase
// ---------------------------------------------------------------------------

export interface PurchaseInput {
  side: Side;
  money: number;
  inv: Inventory;
  class: PlayerClass;
  decision: BuyType;
  /** Another teammate already holds/bought an AWP this round. */
  teamHasAwp: boolean;
}

export interface Purchase {
  inv: Inventory;
  spent: number;
  /** Weapon bought this round (or the one kept). */
  weapon: string;
}

export const RIFLE_RESERVE = 1000; // [v0] GDD 5.4: rifler keeps $1000
export const AWP_MIN_MONEY = 5750; // [v0] GDD 5.4

const MAX_UTILS = 4;

/** Decide what one player buys. Pure: returns the new inventory and spend. */
export function buyForPlayer(input: PurchaseInput, rng: Rng): Purchase {
  const side = input.side;
  const inv: Inventory = { ...input.inv, utils: [...input.inv.utils] };
  let money = input.money;
  let spent = 0;

  const pay = (price: number): boolean => {
    if (money < price) return false;
    money -= price;
    spent += price;
    return true;
  };
  const buyWeapon = (w: Weapon): boolean => {
    if (!pay(w.price)) return false;
    inv.weapon = w.id;
    return true;
  };
  const buyArmor = (helmet: boolean): boolean => {
    if (inv.armor && (inv.helmet || !helmet)) return true;
    if (inv.armor && !inv.helmet && helmet) {
      if (!pay(GEAR.kevlarHelmet - GEAR.kevlar)) return false;
      inv.helmet = true;
      return true;
    }
    if (helmet && pay(GEAR.kevlarHelmet)) {
      inv.armor = true;
      inv.helmet = true;
      return true;
    }
    if (pay(GEAR.kevlar)) {
      inv.armor = true;
      return true;
    }
    return false;
  };
  const buyUtil = (u: UtilId, reserve = 0): boolean => {
    if (inv.utils.length >= MAX_UTILS) return false;
    const count = inv.utils.filter((x) => x === u).length;
    if ((u === 'flash' && count >= 2) || (u !== 'flash' && count >= 1)) return false;
    const price = u === 'molotov' ? GEAR.molotov[side] : GEAR[u];
    if (money - price < reserve) return false;
    pay(price);
    inv.utils.push(u);
    return true;
  };
  const buyKit = (reserve = 0): boolean => {
    if (side !== 'CT' || inv.kit) return false;
    if (money - GEAR.kit < reserve) return false;
    pay(GEAR.kit);
    inv.kit = true;
    return true;
  };
  const ownsRifle = () => hasRifleClass(inv);
  const bestRifleWithin = (budget: number): Weapon | undefined => {
    const options = riflesFor(side).filter((w) => w.price <= budget);
    return options[options.length - 1];
  };

  switch (input.decision) {
    case 'pistol': {
      // $800: kevlar, or a P250 with nades, or a Deagle. [v0] weights
      const roll = rng.next();
      if (input.class === 'support' || roll < 0.35) {
        buyWeapon(weapon('p250'));
        buyUtil('flash');
        buyUtil('he');
      } else if (roll < 0.85) {
        buyArmor(false);
      } else {
        buyWeapon(weapon('deagle'));
      }
      break;
    }
    case 'eco': {
      // Save. Below $1500 nothing is bought (pistol-round losers); with a real
      // loss bonus a P250, and on a rich eco sometimes a Deagle. [v1]
      if (ownsRifle()) break;
      if (money >= ECON.ECO_DEAGLE_MONEY && rng.chance(0.5)) buyWeapon(weapon('deagle'));
      else if (money >= ECON.ECO_P250_MONEY && rng.chance(0.6)) buyWeapon(weapon('p250'));
      break;
    }
    case 'force': {
      // Spend everything sensible: armor first, then the best gun that fits.
      buyArmor(false);
      if (!ownsRifle()) {
        const rifle = bestRifleWithin(money);
        if (rifle) buyWeapon(rifle);
        else if (money >= smgFor(side).price) buyWeapon(smgFor(side));
        else if (money >= weapon('deagle').price) buyWeapon(weapon('deagle'));
        else if (money >= weapon('p250').price && weapon(inv.weapon).tier < 2) buyWeapon(weapon('p250'));
      }
      buyUtil('flash');
      if (input.class === 'support') buyUtil('smoke');
      break;
    }
    case 'full': {
      const isSupport = input.class === 'support';
      const wantsAwp = input.class === 'awper' && !input.teamHasAwp && money >= AWP_MIN_MONEY && weapon(inv.weapon).class !== 'awp';
      if (wantsAwp) {
        buyArmor(true);
        buyWeapon(weapon('awp'));
      } else if (isSupport) {
        buyArmor(true);
        buyUtil('smoke');
        buyUtil('flash');
        buyUtil('flash');
        buyUtil('molotov');
        if (!ownsRifle()) {
          const rifle = bestRifleWithin(money - RIFLE_RESERVE) ?? bestRifleWithin(money);
          if (rifle) buyWeapon(rifle);
          else if (money >= smgFor(side).price) buyWeapon(smgFor(side));
        }
      } else {
        // Rifler default: best rifle that fits leaving $1000, helmet if possible.
        if (!ownsRifle()) {
          const withHelmet = bestRifleWithin(money - GEAR.kevlarHelmet - RIFLE_RESERVE);
          const withKevlar = bestRifleWithin(money - GEAR.kevlar - RIFLE_RESERVE);
          if (withHelmet && (!withKevlar || withHelmet.tier >= withKevlar.tier)) {
            buyArmor(true);
            buyWeapon(withHelmet);
          } else if (withKevlar) {
            buyArmor(false);
            buyWeapon(withKevlar);
          } else {
            // Can't respect the reserve: buy what fits anyway (team said "full").
            buyArmor(false);
            const rifle = bestRifleWithin(money);
            if (rifle) buyWeapon(rifle);
            else if (money >= smgFor(side).price) buyWeapon(smgFor(side));
          }
        } else {
          buyArmor(true);
        }
      }
      // Kit for CT players who stay near sites; others sometimes.
      const kitPriority = input.class === 'anchor' || input.class === 'igl' || isSupport;
      if (kitPriority || rng.chance(0.5)) buyKit(isSupport ? 0 : RIFLE_RESERVE / 2);
      // Leftover into utility, keeping half the reserve.
      const reserve = RIFLE_RESERVE / 2;
      buyUtil('flash', reserve);
      buyUtil('smoke', reserve);
      buyUtil('flash', reserve);
      if (input.class === 'entry' || input.class === 'rifler') buyUtil('molotov', reserve);
      buyUtil('he', reserve);
      break;
    }
  }

  return { inv, spent, weapon: inv.weapon };
}
