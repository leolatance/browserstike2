import { ATTR_KEYS, Rng, clampAttr, type AttrKey, type Attrs } from '@idle-strike/engine';
import { hashSeed } from '../minigames/duelTarget';
import { applyXp, attrCap } from '../progression/xp';
import { db, notify, type CharacterRecord } from './db';

export const CHARACTER = {
  NICK_MIN: 3,
  NICK_MAX: 16,
  AVATAR_SLOTS: 12,
  /** Initial attributes are rolled in [ATTR_MIN, ATTR_MAX] from the nick's seed. [v0] */
  ATTR_MIN: 22,
  ATTR_MAX: 30,
};

export const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'DE', name: 'Alemanha', flag: '🇩🇪' },
  { code: 'FR', name: 'França', flag: '🇫🇷' },
  { code: 'PL', name: 'Polônia', flag: '🇵🇱' },
  { code: 'DK', name: 'Dinamarca', flag: '🇩🇰' },
  { code: 'SE', name: 'Suécia', flag: '🇸🇪' },
  { code: 'UA', name: 'Ucrânia', flag: '🇺🇦' },
];

export const AVATAR_COLORS = ['#ff6a1f', '#4c9df7', '#38d39f', '#f0a13a', '#c66bff', '#ff4a4a', '#ffd166', '#2ec4b6', '#e76f51', '#8ecae6', '#b5e48c', '#f72585'];

export function validNick(nick: string): boolean {
  return nick.trim().length >= CHARACTER.NICK_MIN && nick.trim().length <= CHARACTER.NICK_MAX;
}

/** Reproducible: the same nick always rolls the same starting attributes. */
export function initialAttrs(nick: string): Attrs {
  const rng = new Rng(hashSeed(nick.trim().toLowerCase()));
  const attrs = {} as Attrs;
  for (const k of ATTR_KEYS) attrs[k] = rng.int(CHARACTER.ATTR_MIN, CHARACTER.ATTR_MAX);
  return attrs;
}

export async function getCharacter(): Promise<CharacterRecord | undefined> {
  return db.character.get(1);
}

export async function createCharacter(nick: string, avatar: number, country: string): Promise<CharacterRecord> {
  const record: CharacterRecord = {
    id: 1,
    nick: nick.trim(),
    avatar,
    country,
    attrs: initialAttrs(nick),
    level: 0,
    xp: 0,
    class: 'rifler',
    createdAt: Date.now(),
    build: [],
    dust: 0,
  };
  await db.character.put(record);
  notify();
  return record;
}

export async function updateCharacter(patch: Partial<CharacterRecord>): Promise<void> {
  await db.character.update(1, patch);
  notify();
}

/** Adds XP, levels up, returns the levels reached. */
export async function grantXp(gain: number): Promise<{ level: number; xp: number; reached: number[] }> {
  const c = await getCharacter();
  if (!c) throw new Error('No character');
  const next = applyXp({ level: c.level, xp: c.xp }, gain);
  await updateCharacter({ level: next.level, xp: next.xp });
  return next;
}

/** Applies attribute deltas, clamped to the level cap. */
export async function applyGains(gains: Partial<Attrs>): Promise<Attrs> {
  const c = await getCharacter();
  if (!c) throw new Error('No character');
  const cap = attrCap(c.level);
  const attrs: Attrs = { ...c.attrs };
  for (const [k, d] of Object.entries(gains) as [AttrKey, number][]) attrs[k] = clampAttr(Math.min(cap, attrs[k] + d));
  await updateCharacter({ attrs });
  return attrs;
}
