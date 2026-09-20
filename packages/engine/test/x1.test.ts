import { describe, expect, it } from 'vitest';
import { MAP01 } from '../src/data/maps/map01';
import { isEvent } from '../src/events';
import { ATTR_KEYS, makePlayer, uniformAttrs, type Attrs } from '../src/player';
import { simulateX1 } from '../src/x1';

const p = (id: string, attrs: Attrs) => makePlayer(id, id, 'rifler', attrs);
const plus = (a: Attrs, d: number): Attrs => {
  const o = { ...a };
  for (const k of ATTR_KEYS) o[k] = a[k] + d;
  return o;
};

describe('x1', () => {
  it('first to 10, deterministic, well-formed', () => {
    const r1 = simulateX1({ map: MAP01, a: p('me', uniformAttrs(40)), b: p('bot', uniformAttrs(40)) }, 7);
    const r2 = simulateX1({ map: MAP01, a: p('me', uniformAttrs(40)), b: p('bot', uniformAttrs(40)) }, 7);
    expect(JSON.stringify(r1.log)).toBe(JSON.stringify(r2.log));
    expect(Math.max(...r1.score)).toBe(10);
    expect(Math.min(...r1.score)).toBeLessThan(10);
    expect(r1.log.drill).toBe('x1');
    expect(r1.situations.length).toBeGreaterThanOrEqual(10);
    const kills = r1.log.events.filter((e) => isEvent(e, 'kill'));
    expect(kills.length).toBe(r1.score[0] + r1.score[1]);
    for (const k of kills) expect(k.duel).toBeDefined();
  });

  it('balance: equal → 50% ± 3; +10 in everything → 70–76% (same gate as the 5x5)', () => {
    const N = 4000;
    let eq = 0;
    let plus10 = 0;
    for (let i = 0; i < N; i++) {
      const base = uniformAttrs(40);
      if (simulateX1({ map: MAP01, a: p('a', base), b: p('b', base) }, 1000 + i).winner === 0) eq++;
      if (simulateX1({ map: MAP01, a: p('a', plus(base, 10)), b: p('b', base) }, 5000 + i).winner === 0) plus10++;
    }
    console.log(`[x1] equal ${((100 * eq) / N).toFixed(1)}% · +10 ${((100 * plus10) / N).toFixed(1)}%`);
    expect(eq / N).toBeGreaterThanOrEqual(0.47);
    expect(eq / N).toBeLessThanOrEqual(0.53);
    expect(plus10 / N).toBeGreaterThanOrEqual(0.7);
    expect(plus10 / N).toBeLessThanOrEqual(0.76);
  });
});
