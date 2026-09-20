/**
 * Card inventory, boxes and drops (GDD 6.2, 6.4, 8.1). Rolls are pure and
 * seeded so a match box is reproducible from the match seed.
 */
import { CARDS, CARD_LEVEL_MAX, RARITY_DROP, Rng, card, type Card, type CardId, type CardLevel, type CardRarity, type EquippedCard } from '@idle-strike/engine';
import { db, notify, type BoxRecord, type CardRecord } from './db';

export const DROPS = {
  /** Cards per match box (GDD 8.1: 1 box per solo match). [v1] 2 → first 3-card set after ~9 matches (p50 9, p90 16). */
  MATCH_BOX_CARDS: 2,
};

/** Rarity tier from the GDD 6.2 table (60/25/10/4/1). */
export function rollRarity(rng: Rng): CardRarity {
  let r = rng.next() * 100;
  for (const tier of [1, 2, 3, 4, 5] as CardRarity[]) {
    r -= RARITY_DROP[tier];
    if (r < 0) return tier;
  }
  return 1;
}

function pickFrom(rng: Rng, pool: readonly Card[]): Card {
  return rng.pick(pool);
}

/** One random card: tier first, then uniform within the tier (falls back to lower tiers). */
export function rollCard(rng: Rng): CardId {
  let tier = rollRarity(rng);
  while (tier > 1 && !CARDS.some((c) => c.rarity === tier)) tier = (tier - 1) as CardRarity;
  return pickFrom(rng, CARDS.filter((c) => c.rarity === tier)).id;
}

/** GDD 6.4: 5 common cards — 2 flat, 1 conditional, 2 random class cards. */
export function rollInitialBox(rng: Rng): CardId[] {
  const common = CARDS.filter((c) => c.rarity === 1);
  const flat = common.filter((c) => c.type === 'flat');
  const cond = common.filter((c) => c.type === 'conditional');
  const tagged = common.filter((c) => c.tag);
  const out: CardId[] = [];
  const take = (pool: readonly Card[]) => {
    const left = pool.filter((c) => !out.includes(c.id));
    out.push(pickFrom(rng, left.length ? left : pool).id);
  };
  take(flat);
  take(flat);
  take(cond);
  take(tagged);
  take(tagged);
  return out;
}

export function rollMatchBox(rng: Rng): CardId[] {
  return Array.from({ length: DROPS.MATCH_BOX_CARDS }, () => rollCard(rng));
}

export async function createBox(source: BoxRecord['source'], cards: CardId[]): Promise<number> {
  const id = (await db.boxes.add({ source, createdAt: Date.now(), cards, opened: false })) as number;
  notify();
  return id;
}

export async function unopenedBoxes(): Promise<BoxRecord[]> {
  return db.boxes.filter((b) => !b.opened).sortBy('createdAt');
}

export interface Reveal {
  card: Card;
  /** Level before / after (null before = new card). */
  from: CardLevel | null;
  to: CardLevel;
  /** Already at III: the copy is kept as qty (dust later). */
  overflow: boolean;
}

/** Opens a box: each card either enters the inventory or levels up a duplicate. */
export async function openBox(boxId: number): Promise<Reveal[]> {
  const box = await db.boxes.get(boxId);
  if (!box || box.opened) return [];
  const reveals: Reveal[] = [];
  await db.transaction('rw', db.cards, db.boxes, async () => {
    for (const id of box.cards) {
      const c = card(id);
      const row = await db.cards.get(id);
      if (!row) {
        await db.cards.put({ id, qty: 1, level: 1, acquiredAt: Date.now() });
        reveals.push({ card: c, from: null, to: 1, overflow: false });
      } else if (row.level < CARD_LEVEL_MAX) {
        const to = (row.level + 1) as CardLevel;
        await db.cards.put({ ...row, level: to });
        reveals.push({ card: c, from: row.level, to, overflow: false });
      } else {
        await db.cards.put({ ...row, qty: row.qty + 1 });
        reveals.push({ card: c, from: row.level, to: row.level, overflow: true });
      }
    }
    await db.boxes.update(boxId, { opened: true });
  });
  notify();
  return reveals;
}

export async function listCards(): Promise<CardRecord[]> {
  return db.cards.toArray();
}

/** Persists the build after dropping cards the player no longer owns. */
export async function saveBuild(cards: EquippedCard[]): Promise<void> {
  const owned = new Map((await db.cards.toArray()).map((c) => [c.id, c.level]));
  const clean = cards.filter((c) => owned.has(c.id)).map((c) => ({ id: c.id, level: owned.get(c.id) as CardLevel }));
  await db.character.update(1, { build: clean });
  notify();
}

/** Current build with levels refreshed from the inventory. */
export async function currentBuild(): Promise<EquippedCard[]> {
  const c = await db.character.get(1);
  if (!c) return [];
  const owned = new Map((await db.cards.toArray()).map((x) => [x.id, x.level]));
  return (c.build ?? []).filter((e) => owned.has(e.id)).map((e) => ({ id: e.id, level: owned.get(e.id) as CardLevel }));
}
