import { db, localDay, notify, type TrainingRecord } from './db';

/** Sessions (treino + DM share the counter) completed today. */
export async function sessionsToday(): Promise<number> {
  return db.training.where('day').equals(localDay()).count();
}

export async function saveSession(record: TrainingRecord): Promise<number> {
  const id = (await db.training.add(record)) as number;
  notify();
  return id;
}
