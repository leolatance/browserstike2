/**
 * Local persistence (GDD 14, Fase 1). Dexie / IndexedDB, versioned from day one.
 */
import Dexie, { type Table } from 'dexie';
import type { Attrs, CardId, CardLevel, EquippedCard, PlayerClass, PlayerStats, Team } from '@idle-strike/engine';
import type { DuelTargetStats } from '../minigames/duelTarget';

export interface CharacterRecord {
  id: 1;
  nick: string;
  avatar: number;
  country: string;
  attrs: Attrs;
  level: number;
  xp: number;
  class: PlayerClass;
  createdAt: number;
  /** Equipped cards in slot order (v2). */
  build: EquippedCard[];
}

export interface CardRecord {
  id: CardId;
  /** Copies beyond level III (dust later). */
  qty: number;
  level: CardLevel;
  acquiredAt: number;
}

export interface BoxRecord {
  id?: number;
  source: 'initial' | 'match';
  createdAt: number;
  /** Pre-rolled contents (deterministic per match seed). */
  cards: CardId[];
  opened: boolean;
}

export interface MatchRecord {
  id?: number;
  playedAt: number;
  seed: number;
  config: { mapId: string; teams: [Team, Team]; startingCT: 0 | 1 };
  score: [number, number];
  winner: 0 | 1;
  /** Index of the character's team in `config.teams`. */
  myTeam: 0 | 1;
  myId: string;
  stats: PlayerStats;
  rating: number;
  rewards: {
    xp: number;
    minigame: DuelTargetStats | null;
    levelFrom: number;
    levelTo: number;
  };
  /** Left the match early: counted as a loss, rating 0, no XP. */
  abandoned?: boolean;
}

export interface TrainingRecord {
  id?: number;
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  startedAt: number;
  mode: 'treino' | 'dm';
  focus: keyof Attrs | null;
  gains: Partial<Attrs>;
  minigameAverage: number;
  yieldLabel: string;
  xp: number;
}

export interface SettingsRecord {
  key: string;
  value: unknown;
}

export class IdleStrikeDB extends Dexie {
  character!: Table<CharacterRecord, number>;
  matches!: Table<MatchRecord, number>;
  training!: Table<TrainingRecord, number>;
  settings!: Table<SettingsRecord, string>;
  cards!: Table<CardRecord, string>;
  boxes!: Table<BoxRecord, number>;

  constructor() {
    super('idle-strike-2');
    this.version(1).stores({
      character: 'id',
      matches: '++id, playedAt',
      training: '++id, day, startedAt',
      settings: 'key',
    });
    // v2 (GDD 6): card inventory, boxes, and the build on the character.
    this.version(2)
      .stores({
        character: 'id',
        matches: '++id, playedAt',
        training: '++id, day, startedAt',
        settings: 'key',
        cards: 'id',
        boxes: '++id, createdAt, opened',
      })
      .upgrade((tx) =>
        tx
          .table('character')
          .toCollection()
          .modify((c: Partial<CharacterRecord>) => {
            c.build ??= [];
          }),
      );
  }
}

export const db = new IdleStrikeDB();

/** Wipes everything (dev). */
export async function resetAll(): Promise<void> {
  await db.delete();
  await db.open();
  notify();
}

// ---------------------------------------------------------------------------
// Tiny change bus so screens re-query after writes (no global state library).
// ---------------------------------------------------------------------------
const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notify(): void {
  for (const fn of listeners) fn();
}

export function localDay(ts = Date.now()): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

if (import.meta.env.DEV) (window as unknown as { __db?: unknown }).__db = { db, resetAll };
