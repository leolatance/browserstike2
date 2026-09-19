import { db, notify } from './db';
import { TRAINING } from '../progression/training';

export interface Settings {
  minigame: boolean;
  treinoSeconds: number;
  dmSeconds: number;
}

export const SETTING_DEFAULTS: Settings = {
  minigame: true,
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
