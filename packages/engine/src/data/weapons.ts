/**
 * Weapon and gear tables (GDD 5.4). Pure data: no logic lives here.
 * Range modifiers are added to the duel score (GDD 5.5) according to the
 * `range` of the area where the duel happens.
 */
import type { Side } from '../events';

export type WeaponClass = 'knife' | 'pistol' | 'smg' | 'shotgun' | 'rifle' | 'awp';
export type Range = 'short' | 'mid' | 'long';

export interface Weapon {
  id: string;
  name: string;
  class: WeaponClass;
  price: number;
  killReward: number;
  /** Duel score modifier by engagement range. [v0] */
  rangeMod: Record<Range, number>;
  /** Which side can buy it. Starter pistols are given, not bought. */
  side: Side | 'both';
  /** Higher = preferred when picking up a dropped weapon. */
  tier: number;
}

export const KILL_REWARD = {
  rifle: 300,
  awp: 100,
  smg: 600,
  shotgun: 900,
  knife: 1500,
  pistol: 300,
} as const satisfies Record<WeaponClass, number>;

// Range modifiers (GDD 5.4): AWP +18 long / -10 short; rifle 0; SMG -6 (+6 short).
// [v0 → v1] pistol -18 → -15 (all pistols +3): eco vs full buy sat at ~11%, target 12–20%.
const RIFLE_MOD: Record<Range, number> = { short: 0, mid: 0, long: 0 };
const SMG_MOD: Record<Range, number> = { short: 6, mid: -6, long: -6 };
const AWP_MOD: Record<Range, number> = { short: -10, mid: 4, long: 18 };
const PISTOL_MOD: Record<Range, number> = { short: -15, mid: -15, long: -15 };

export const WEAPONS: readonly Weapon[] = [
  { id: 'knife', name: 'Faca', class: 'knife', price: 0, killReward: KILL_REWARD.knife, rangeMod: { short: -40, mid: -60, long: -80 }, side: 'both', tier: 0 },

  // Pistols
  { id: 'glock', name: 'Glock', class: 'pistol', price: 200, killReward: KILL_REWARD.pistol, rangeMod: PISTOL_MOD, side: 'T', tier: 1 },
  { id: 'usp', name: 'USP', class: 'pistol', price: 200, killReward: KILL_REWARD.pistol, rangeMod: PISTOL_MOD, side: 'CT', tier: 1 },
  { id: 'p250', name: 'P250', class: 'pistol', price: 300, killReward: KILL_REWARD.pistol, rangeMod: { short: -12, mid: -13, long: -15 }, side: 'both', tier: 2 },
  { id: 'deagle', name: 'Deagle', class: 'pistol', price: 700, killReward: KILL_REWARD.pistol, rangeMod: { short: -10, mid: -9, long: -9 }, side: 'both', tier: 3 },

  // SMGs
  { id: 'mac10', name: 'MAC-10', class: 'smg', price: 1050, killReward: KILL_REWARD.smg, rangeMod: SMG_MOD, side: 'T', tier: 4 },
  { id: 'mp9', name: 'MP9', class: 'smg', price: 1250, killReward: KILL_REWARD.smg, rangeMod: SMG_MOD, side: 'CT', tier: 4 },

  // Shotgun
  { id: 'nova', name: 'Nova', class: 'shotgun', price: 1050, killReward: KILL_REWARD.shotgun, rangeMod: { short: 4, mid: -14, long: -30 }, side: 'both', tier: 4 },

  // Rifles
  { id: 'galil', name: 'Galil', class: 'rifle', price: 1800, killReward: KILL_REWARD.rifle, rangeMod: { short: -2, mid: -2, long: -3 }, side: 'T', tier: 5 },
  { id: 'famas', name: 'FAMAS', class: 'rifle', price: 2050, killReward: KILL_REWARD.rifle, rangeMod: { short: -2, mid: -2, long: -3 }, side: 'CT', tier: 5 },
  { id: 'ak47', name: 'AK-47', class: 'rifle', price: 2700, killReward: KILL_REWARD.rifle, rangeMod: RIFLE_MOD, side: 'T', tier: 6 },
  { id: 'm4s', name: 'M4 Supressor', class: 'rifle', price: 2900, killReward: KILL_REWARD.rifle, rangeMod: RIFLE_MOD, side: 'CT', tier: 6 },
  { id: 'm4', name: 'M4', class: 'rifle', price: 3100, killReward: KILL_REWARD.rifle, rangeMod: RIFLE_MOD, side: 'CT', tier: 6 },

  // Sniper
  { id: 'awp', name: 'AWP', class: 'awp', price: 4750, killReward: KILL_REWARD.awp, rangeMod: AWP_MOD, side: 'both', tier: 7 },
];

const BY_ID: Record<string, Weapon> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export function weapon(id: string): Weapon {
  const w = BY_ID[id];
  if (!w) throw new Error(`Unknown weapon: ${id}`);
  return w;
}

export function starterPistol(side: Side): Weapon {
  return side === 'T' ? weapon('glock') : weapon('usp');
}

/** Rifles a side can buy, cheapest first. */
export function riflesFor(side: Side): Weapon[] {
  return WEAPONS.filter((w) => w.class === 'rifle' && (w.side === side || w.side === 'both')).sort((a, b) => a.price - b.price);
}

export function smgFor(side: Side): Weapon {
  return side === 'T' ? weapon('mac10') : weapon('mp9');
}

export type UtilId = 'flash' | 'smoke' | 'molotov' | 'he';

export const GEAR = {
  kevlar: 650,
  kevlarHelmet: 1000,
  kit: 400,
  flash: 200,
  smoke: 300,
  /** Molotov (T) / incendiary (CT). */
  molotov: { T: 400, CT: 600 } as Record<Side, number>,
  he: 300,
} as const;

/** Duel score penalty for having no armor. [v0 → v1] GDD 5.4 said −8; eco rounds won only ~10%. */
export const NO_ARMOR_PENALTY = -5;
