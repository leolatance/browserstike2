import { describe, expect, it } from 'vitest';
import { MAP01 } from '../src/data/maps/map01';
import { shortestPath, validateMap } from '../src/map';

describe('map01 (Baixada)', () => {
  it('is internally consistent', () => {
    expect(() => validateMap(MAP01)).not.toThrow();
  });

  it('does not use a real map name', () => {
    const banned = ['dust', 'mirage', 'inferno', 'nuke', 'overpass', 'ancient', 'anubis', 'vertigo', 'train', 'cache'];
    for (const b of banned) expect(MAP01.name.toLowerCase()).not.toContain(b);
  });

  it('both spawns reach both sites; every area is reachable', () => {
    for (const site of ['A', 'B'] as const) {
      expect(shortestPath(MAP01, MAP01.spawns.T, MAP01.sites[site].plant)).not.toBeNull();
      expect(shortestPath(MAP01, MAP01.spawns.CT, MAP01.sites[site].plant)).not.toBeNull();
    }
    for (const a of MAP01.areas) expect(shortestPath(MAP01, MAP01.spawns.T, a.id)).not.toBeNull();
  });

  it('T reaches B faster than A, and CTs reach sites before Ts', () => {
    const tA = shortestPath(MAP01, 't_spawn', 'a_site')!.time;
    const tB = shortestPath(MAP01, 't_spawn', 'b_site')!.time;
    const ctA = shortestPath(MAP01, 'ct_spawn', 'a_site')!.time;
    const ctB = shortestPath(MAP01, 'ct_spawn', 'b_site')!.time;
    expect(tB).toBeLessThan(tA);
    expect(ctA).toBeLessThan(tA);
    expect(ctB).toBeLessThan(tB);
  });

  it('CT rotation A→B takes a realistic 12–25s', () => {
    const rot = shortestPath(MAP01, 'a_site', 'b_site')!;
    expect(rot.time).toBeGreaterThanOrEqual(12);
    expect(rot.time).toBeLessThanOrEqual(25);
    expect(rot.path[0]).toBe('a_site');
    expect(rot.path[rot.path.length - 1]).toBe('b_site');
  });

  it('shortestPath handles trivial and unreachable cases', () => {
    expect(shortestPath(MAP01, 'mid', 'mid')).toEqual({ path: ['mid'], time: 0 });
    expect(shortestPath({ ...MAP01, routes: [] }, 't_spawn', 'a_site')).toBeNull();
  });
});
