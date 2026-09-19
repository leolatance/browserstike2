/**
 * Player / Team model and effective attribute computation (GDD 3.2–3.4, 5.6).
 */
import type { PlayerId } from './events';

export interface Attrs {
  mira: number;
  mov: number;
  peek: number;
  tatico: number;
  util: number;
  mental: number;
}

export const ATTR_KEYS = ['mira', 'mov', 'peek', 'tatico', 'util', 'mental'] as const satisfies readonly (keyof Attrs)[];
export type AttrKey = (typeof ATTR_KEYS)[number];

export type PlayerClass = 'entry' | 'igl' | 'awper' | 'anchor' | 'rifler' | 'support' | 'star';

export type CardId = string;

/**
 * Build hook. Cards are NOT implemented in this step: the type exists so the
 * data model is stable, and `applyBuild` is an identity for now.
 */
export interface Build {
  cards: readonly CardId[];
}

export const EMPTY_BUILD: Build = { cards: [] };

export interface Player {
  id: PlayerId;
  nick: string;
  attrs: Attrs;
  class: PlayerClass;
  build: Build;
  /** Recent-form multiplier for starting Mental (GDD 5.6). 1.0 = neutral. */
  form?: number;
  /** Cosmetic ids (opaque to the engine, echoed in the log later). */
  cosmetics?: Record<string, string>;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clampAttr(v: number): number {
  return clamp(v, 0, 100);
}

/** Situational context that can change attributes at duel time. */
export interface Situation {
  /** Current in-match Mental (GDD 5.6). Defaults to the base attribute. */
  mental?: number;
  /** Team has no IGL → team Tático −15% [v0] (GDD 3.3). */
  noIgl?: boolean;
}

// [v0] GDD 3.3: team without IGL loses 15% effective Tático.
export const NO_IGL_TATICO_MULT = 0.85;

// [v0] GDD 5.6: Mental is a light multiplier on every attribute.
export function mentalMultiplier(mental: number): number {
  return 0.9 + 0.2 * (clampAttr(mental) / 100);
}

// [v0] GDD 5.6: starting Mental = base × clamp(0.85, 1.15, form)
export function initialMental(player: Player): number {
  const form = clamp(player.form ?? 1, 0.85, 1.15);
  return clampAttr(player.attrs.mental * form);
}

/** Cards hook: returns flat bonuses per attribute. Empty until cards land. */
export function buildBonuses(_build: Build, _situation: Situation): Partial<Attrs> {
  return {};
}

/**
 * GDD 3.4: `efetivo = base + Σ bônus planos das cartas + modificadores
 * situacionais`, clamped to 0–100. Mental multiplies the other five.
 */
export function effectiveAttrs(player: Player, situation: Situation = {}): Attrs {
  const mental = clampAttr(situation.mental ?? player.attrs.mental);
  const bonus = buildBonuses(player.build, situation);
  const mult = mentalMultiplier(mental);
  const base = player.attrs;
  const out: Attrs = {
    mira: (base.mira + (bonus.mira ?? 0)) * mult,
    mov: (base.mov + (bonus.mov ?? 0)) * mult,
    peek: (base.peek + (bonus.peek ?? 0)) * mult,
    tatico: (base.tatico + (bonus.tatico ?? 0)) * mult,
    util: (base.util + (bonus.util ?? 0)) * mult,
    mental,
  };
  if (situation.noIgl) out.tatico *= NO_IGL_TATICO_MULT;
  out.mira = clampAttr(out.mira);
  out.mov = clampAttr(out.mov);
  out.peek = clampAttr(out.peek);
  out.tatico = clampAttr(out.tatico);
  out.util = clampAttr(out.util);
  return out;
}

export function averageAttr(attrs: Attrs): number {
  let sum = 0;
  for (const k of ATTR_KEYS) sum += attrs[k];
  return sum / ATTR_KEYS.length;
}

export function makePlayer(id: PlayerId, nick: string, cls: PlayerClass, attrs: Attrs, form?: number): Player {
  const p: Player = { id, nick, attrs: { ...attrs }, class: cls, build: EMPTY_BUILD };
  if (form !== undefined) p.form = form;
  return p;
}

export function uniformAttrs(v: number): Attrs {
  return { mira: v, mov: v, peek: v, tatico: v, util: v, mental: v };
}

export function findIgl(team: Team): Player | undefined {
  return team.players.find((p) => p.class === 'igl');
}
