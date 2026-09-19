import { describe, expect, it } from 'vitest';
import { MAP01 } from '../src/data/maps/map01';
import { simulateMatch } from '../src/match';
import { botTeams } from './helpers';

describe('determinism', () => {
  it('simulateMatch(cfg, 42) twice → identical logs', () => {
    const cfg = () => ({ map: MAP01, teams: botTeams(42) });
    const a = JSON.stringify(simulateMatch(cfg(), 42));
    const b = JSON.stringify(simulateMatch(cfg(), 42));
    expect(a).toBe(b);
    expect(JSON.stringify(simulateMatch(cfg(), 43))).not.toBe(a);
  });

  it('engine source never touches Math.random, Date, performance, window or document', () => {
    const files = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const names = Object.keys(files);
    expect(names.length).toBeGreaterThan(10);
    const banned: [string, RegExp][] = [
      ['Math.random', /Math\.random/],
      ['Date', /\bDate\b/],
      ['performance', /\bperformance\b/],
      ['window', /\bwindow\b/],
      ['document', /\bdocument\b/],
    ];
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(files)) {
      for (const [label, re] of banned) if (re.test(src)) offenders.push(`${path}: ${label}`);
    }
    expect(offenders).toEqual([]);
  });
});
