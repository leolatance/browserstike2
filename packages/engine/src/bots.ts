/**
 * Bot team generator (GDD 4.3, 5.7): attributes ≈ target ± spread, classes
 * distributed (1 IGL, 1 AWPer, 1 Entry, 2 Rifler/Âncora), parody names.
 */
import { BOT_NICKS, BOT_TEAM_NAMES } from './data/botnames';
import { ATTR_KEYS, clampAttr, makePlayer, type AttrKey, type Attrs, type Player, type PlayerClass, type Team } from './player';
import type { Rng } from './rng';

export const BOT_SPREAD = 8; // [v0] GDD 4.3: média do jogador ± 8

/** Default composition. */
export const BOT_CLASSES: readonly PlayerClass[] = ['igl', 'awper', 'entry', 'rifler', 'anchor'];

/** Attribute the class leans on (+flavor) and one it neglects (−flavor). */
const CLASS_FLAVOR: Record<PlayerClass, { up: AttrKey[]; down: AttrKey[] }> = {
  entry: { up: ['peek', 'mira'], down: ['tatico', 'util'] },
  igl: { up: ['tatico', 'mental'], down: ['peek', 'mira'] },
  awper: { up: ['mira', 'mov'], down: ['util', 'peek'] },
  anchor: { up: ['tatico', 'mental'], down: ['peek', 'mov'] },
  rifler: { up: ['mira', 'mov'], down: ['util', 'mental'] },
  support: { up: ['util', 'tatico'], down: ['mira', 'peek'] },
  star: { up: ['mira', 'mental'], down: ['util', 'tatico'] },
};

const CLASS_FLAVOR_AMOUNT = 3; // [v0]

export interface BotTeamOptions {
  rng: Rng;
  /** Target average attribute (0–100). */
  targetAvg: number;
  /** ± noise per attribute. Defaults to BOT_SPREAD. */
  spread?: number;
  /** Class composition; defaults to BOT_CLASSES. */
  classes?: readonly PlayerClass[];
  /** Id prefix so two bot teams never collide. */
  idPrefix: string;
  name?: string;
  /** Apply class flavor (+3 on key attrs, −3 on neglected). Default true. */
  flavor?: boolean;
}

export function generateBotAttrs(rng: Rng, targetAvg: number, spread: number, cls: PlayerClass, flavor = true): Attrs {
  const attrs = {} as Attrs;
  for (const k of ATTR_KEYS) attrs[k] = targetAvg + rng.int(-spread, spread);
  if (flavor) {
    const f = CLASS_FLAVOR[cls];
    for (const k of f.up) attrs[k] += CLASS_FLAVOR_AMOUNT;
    for (const k of f.down) attrs[k] -= CLASS_FLAVOR_AMOUNT;
  }
  for (const k of ATTR_KEYS) attrs[k] = clampAttr(Math.round(attrs[k]));
  return attrs;
}

export function generateBotTeam(opts: BotTeamOptions): Team {
  const { rng, targetAvg, idPrefix } = opts;
  const spread = opts.spread ?? BOT_SPREAD;
  const classes = opts.classes ?? BOT_CLASSES;
  const nicks = rng.shuffle(BOT_NICKS);
  const name = opts.name ?? rng.pick(BOT_TEAM_NAMES);
  const players: Player[] = classes.map((cls, i) =>
    makePlayer(`${idPrefix}${i + 1}`, nicks[i] as string, cls, generateBotAttrs(rng, targetAvg, spread, cls, opts.flavor ?? true)),
  );
  return { id: idPrefix, name, players };
}

/** Two bot teams that never share nicks or names. */
export function generateBotMatchup(rng: Rng, targetAvgA: number, targetAvgB: number, spread?: number): [Team, Team] {
  const names = rng.shuffle(BOT_TEAM_NAMES);
  const nicks = rng.shuffle(BOT_NICKS);
  const build = (prefix: string, avg: number, name: string, nickOffset: number): Team => ({
    id: prefix,
    name,
    players: BOT_CLASSES.map((cls, i) =>
      makePlayer(`${prefix}${i + 1}`, nicks[nickOffset + i] as string, cls, generateBotAttrs(rng, avg, spread ?? BOT_SPREAD, cls)),
    ),
  });
  return [build('a', targetAvgA, names[0] as string, 0), build('b', targetAvgB, names[1] as string, 5)];
}
