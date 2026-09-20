/**
 * Player / Team model and effective attribute computation (GDD 3.2–3.4, 5.6).
 */
import type { PlayerId } from './events';
import { SET_SIZE, card, cardValue, type Behavior, type CardCondition, type CardId, type CardLevel } from './data/cards';

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

export type { CardId } from './data/cards';

export interface EquippedCard {
  id: CardId;
  level: CardLevel;
}

/** Equipped cards, in slot order (GDD 6). */
export interface Build {
  cards: readonly EquippedCard[];
}

/** A situational bonus: an attribute (or raw score) added when `when` matches. */
export interface CondEffect {
  /** Card id, or `set:<class>` for a set bonus. */
  source: string;
  attr: AttrKey | 'score';
  value: number;
  when: CardCondition;
}

/** Everything the simulation needs to know about a build, precomputed. */
export interface ResolvedBuild {
  flat: Partial<Attrs>;
  conditionals: CondEffect[];
  behaviors: ReadonlySet<Behavior>;
  /** Classes whose set (3 cards with the tag) is complete, in slot order. */
  sets: PlayerClass[];
  /** Class the sim plays; Rifler without a set. Hybrid = sets[0] with both bonuses. */
  activeClass: PlayerClass;
  /** Anchor set: extra retreat chance when defending the site. */
  siteSurvival: number;
  /** Anchor set: money per round survived. */
  surviveMoney: number;
  /** IGL set: Tático added to the team's buy/call decisions. */
  teamTatico: number;
  /** Support set: multiplier on the thrower's Util for flashes. */
  utilMult: number;
  /** Entry set: a teammate always trades within 3s. */
  guaranteedTrade: boolean;
  /** Support set: flash assists always credited. */
  flashAssistSure: boolean;
}

export const SET_BONUS = {
  ENTRY_FIRST_PEEK: 10, // [v0] GDD 6.3
  IGL_TEAM_TATICO: 8, // [v0]
  AWPER_LONG_MIRA: 6, // [v0]
  ANCHOR_SITE_SURVIVAL: 0.12, // [v0]
  ANCHOR_SURVIVE_MONEY: 200, // [v0]
  SUPPORT_UTIL_MULT: 1.15, // [v0]
  STAR_FIRST_DUEL_SCORE: 6, // [v0]
};

const EMPTY_RESOLVED: ResolvedBuild = {
  flat: {},
  conditionals: [],
  behaviors: new Set(),
  sets: [],
  activeClass: 'rifler',
  siteSurvival: 0,
  surviveMoney: 0,
  teamTatico: 0,
  utilMult: 1,
  guaranteedTrade: false,
  flashAssistSure: false,
};

const RESOLVED_CACHE = new WeakMap<Build, ResolvedBuild>();

export function resolveBuild(build: Build): ResolvedBuild {
  if (build.cards.length === 0) return EMPTY_RESOLVED;
  const cached = RESOLVED_CACHE.get(build);
  if (cached) return cached;
  const flat: Partial<Attrs> = {};
  const conditionals: CondEffect[] = [];
  const behaviors = new Set<Behavior>();
  const tagCount = new Map<PlayerClass, number>();
  const tagOrder: PlayerClass[] = [];
  const seen = new Set<CardId>();
  for (const eq of build.cards) {
    if (seen.has(eq.id)) continue; // one copy of each card
    seen.add(eq.id);
    const c = card(eq.id);
    const v = cardValue(c, eq.level);
    if (c.effect.kind === 'flat') flat[c.effect.attr] = (flat[c.effect.attr] ?? 0) + v;
    else if (c.effect.kind === 'conditional') conditionals.push({ source: c.id, attr: c.effect.attr, value: v, when: c.effect.when });
    else behaviors.add(c.effect.behavior);
    if (c.tag) {
      if (!tagCount.has(c.tag)) tagOrder.push(c.tag);
      tagCount.set(c.tag, (tagCount.get(c.tag) ?? 0) + 1);
    }
  }
  const sets = tagOrder.filter((t) => (tagCount.get(t) ?? 0) >= SET_SIZE);
  const out: ResolvedBuild = { ...EMPTY_RESOLVED, flat, conditionals, behaviors, sets, activeClass: sets[0] ?? 'rifler' };
  for (const s of sets) {
    switch (s) {
      case 'entry':
        conditionals.push({ source: 'set:entry', attr: 'peek', value: SET_BONUS.ENTRY_FIRST_PEEK, when: { role: 'attacker', firstDuel: true } });
        out.guaranteedTrade = true;
        break;
      case 'igl':
        out.teamTatico = SET_BONUS.IGL_TEAM_TATICO;
        break;
      case 'awper':
        behaviors.add('awp_discount');
        conditionals.push({ source: 'set:awper', attr: 'mira', value: SET_BONUS.AWPER_LONG_MIRA, when: { range: 'long' } });
        break;
      case 'anchor':
        out.siteSurvival = SET_BONUS.ANCHOR_SITE_SURVIVAL;
        out.surviveMoney = SET_BONUS.ANCHOR_SURVIVE_MONEY;
        break;
      case 'support':
        out.utilMult = SET_BONUS.SUPPORT_UTIL_MULT;
        out.flashAssistSure = true;
        break;
      case 'star':
        conditionals.push({ source: 'set:star', attr: 'score', value: SET_BONUS.STAR_FIRST_DUEL_SCORE, when: { firstDuel: true } });
        break;
      default:
        break;
    }
  }
  RESOLVED_CACHE.set(build, out);
  return out;
}

/** Set progress per class tag: how many distinct tagged cards are equipped. */
export function setProgress(build: Build): Partial<Record<PlayerClass, number>> {
  const out: Partial<Record<PlayerClass, number>> = {};
  const seen = new Set<CardId>();
  for (const eq of build.cards) {
    if (seen.has(eq.id)) continue;
    seen.add(eq.id);
    const c = card(eq.id);
    if (c.tag) out[c.tag] = (out[c.tag] ?? 0) + 1;
  }
  return out;
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

/** Flat bonuses from the equipped cards (GDD 6.1 "plana"). */
export function buildBonuses(build: Build, _situation: Situation): Partial<Attrs> {
  return resolveBuild(build).flat;
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
