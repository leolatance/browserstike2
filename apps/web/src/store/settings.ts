import { db, notify } from './db';
import { TRAINING } from '../progression/training';

export interface LastSeen {
  attrs: Record<string, number>;
  level: number;
  at: number;
}

export interface Settings {
  minigame: boolean;
  /** Hit sound in training/DM (off by default). */
  sound: boolean;
  /** Snapshot taken when the lobby was last shown, to highlight what changed. */
  lastSeen: LastSeen | null;
  /** Cloud sync bookkeeping. */
  lastPushAt: number | null;
  photoUploadedAt: number | null;
  /** Passive online participations already shown in the lobby. */
  seenParticipations: number;
  /** Let the character be recruited into online lobbies while the owner is away (GDD 4.4). */
  availablePassive: boolean;
  treinoSeconds: number;
  dmSeconds: number;
}

export const SETTING_DEFAULTS: Settings = {
  minigame: true,
  sound: false,
  lastSeen: null,
  lastPushAt: null,
  photoUploadedAt: null,
  seenParticipations: 0,
  availablePassive: true,
  /** Session lengths (seconds) — editable for testing: __db.db.settings.put({key:'treinoSeconds', value: 30}) */
  treinoSeconds: TRAINING.TREINO_SECONDS,
  dmSeconds: TRAINING.DM_SECONDS,
};

export type SettingKey = keyof Settings;

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key);
  return (row?.value as Settings[K] | undefined) ?? SETTING_DEFAULTS[key];
}

export async function setSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value });
  notify();
}
