import { db, notify, type X1Record } from './db';

export async function saveX1(record: X1Record): Promise<number> {
  const id = (await db.x1.add(record)) as number;
  notify();
  return id;
}

export async function listX1(limit = 20): Promise<X1Record[]> {
  return db.x1.orderBy('playedAt').reverse().limit(limit).toArray();
}

export function x1Badge(r: X1Record): string {
  const kind = r.kind === 'bot' ? 'x1 vs bot' : r.kind === 'mira' ? 'x1 de mira' : 'x1 de build';
  return `${kind}: ${r.score[0]}–${r.score[1]} vs ${r.opponent}${r.wo ? ' (W.O.)' : ''}`;
}
