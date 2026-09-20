import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MAP01 } from '../src/data/maps/map01';
import { simulateMatch } from '../src/match';
import type { MatchLog } from '../src/events';
import { botTeams } from './helpers';

/** Same FNV-1a as supabase/functions/_shared/queue.ts. */
function logHash(log: MatchLog): string {
  const s = JSON.stringify(log.events);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

describe('client/server determinism fixture', () => {
  it('writes the fixture (seed, config, hash) the Deno test checks against', () => {
    const teams = botTeams(2026);
    const config = { mapId: 'baixada', teams, startingCT: 1 as const };
    const log = simulateMatch({ map: MAP01, teams, startingCT: 1 }, 2026);
    const hash = logHash(log);
    const dir = new URL('./fixtures/', import.meta.url).pathname;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const file = `${dir}determinism.json`;
    if (existsSync(file)) {
      const prev = JSON.parse(readFileSync(file, 'utf8')) as { hash: string };
      expect(hash).toBe(prev.hash);
    } else writeFileSync(file, JSON.stringify({ seed: 2026, config, hash }, null, 2));
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});
