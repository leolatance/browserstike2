import { describe, expect, it } from 'vitest';
import { BOT_NICKS, BOT_TEAM_NAMES } from '../src/data/botnames';
import { BOT_CLASSES, BOT_SPREAD, generateBotMatchup, generateBotTeam } from '../src/bots';
import { ATTR_KEYS, averageAttr } from '../src/player';
import { Rng } from '../src/rng';

describe('bots', () => {
  it('generates 5 players with the GDD class distribution', () => {
    const team = generateBotTeam({ rng: new Rng(1), targetAvg: 50, idPrefix: 'b' });
    expect(team.players).toHaveLength(5);
    expect(team.players.map((p) => p.class).sort()).toEqual([...BOT_CLASSES].sort());
    expect(new Set(team.players.map((p) => p.id)).size).toBe(5);
    expect(new Set(team.players.map((p) => p.nick)).size).toBe(5);
    expect(BOT_TEAM_NAMES).toContain(team.name);
  });

  it('attributes stay within target ± (spread + flavor) and average near target', () => {
    const rng = new Rng(2);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 200; i++) {
      const team = generateBotTeam({ rng, targetAvg: 50, idPrefix: 'b' });
      for (const p of team.players) {
        for (const k of ATTR_KEYS) {
          expect(p.attrs[k]).toBeGreaterThanOrEqual(50 - BOT_SPREAD - 3);
          expect(p.attrs[k]).toBeLessThanOrEqual(50 + BOT_SPREAD + 3);
        }
        sum += averageAttr(p.attrs);
        n++;
      }
    }
    expect(sum / n).toBeCloseTo(50, 0);
  });

  it('clamps at the edges (target 95 never exceeds 100)', () => {
    const team = generateBotTeam({ rng: new Rng(3), targetAvg: 98, idPrefix: 'b' });
    for (const p of team.players) for (const k of ATTR_KEYS) expect(p.attrs[k]).toBeLessThanOrEqual(100);
    const low = generateBotTeam({ rng: new Rng(3), targetAvg: 2, idPrefix: 'b' });
    for (const p of low.players) for (const k of ATTR_KEYS) expect(p.attrs[k]).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic and a matchup has no shared names', () => {
    expect(generateBotTeam({ rng: new Rng(9), targetAvg: 60, idPrefix: 'x' })).toEqual(
      generateBotTeam({ rng: new Rng(9), targetAvg: 60, idPrefix: 'x' }),
    );
    const [a, b] = generateBotMatchup(new Rng(4), 50, 60);
    expect(a.name).not.toBe(b.name);
    const nicks = [...a.players, ...b.players].map((p) => p.nick);
    expect(new Set(nicks).size).toBe(10);
    expect(averageAttr(b.players[0]!.attrs)).toBeGreaterThan(averageAttr(a.players[0]!.attrs) - 20);
  });

  it('name tables have no duplicates', () => {
    expect(new Set(BOT_NICKS).size).toBe(BOT_NICKS.length);
    expect(new Set(BOT_TEAM_NAMES).size).toBe(BOT_TEAM_NAMES.length);
  });
});
