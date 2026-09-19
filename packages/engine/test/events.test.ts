import { describe, expect, it } from 'vitest';
import { isEvent, type MatchEvent } from '../src/events';

describe('events', () => {
  it('isEvent narrows the union', () => {
    const events: MatchEvent[] = [
      { type: 'roundStart', round: 1, t: 0, score: [0, 0], sides: { CT: 0, T: 1 }, money: {}, buy: { CT: 'pistol', T: 'pistol' }, pistol: true },
      { type: 'kill', round: 1, t: 30, attacker: 'a', victim: 'b', weapon: 'ak47', headshot: true, area: 'mid' },
      { type: 'move', round: 1, t: 5, player: 'a', from: 't_spawn', to: 'mid', duration: 12 },
      { type: 'roundEnd', round: 1, t: 60, winner: 'T', winnerTeam: 1, reason: 'elimination', score: [0, 1], survivors: ['a'] },
    ];
    const kills = events.filter((e) => isEvent(e, 'kill'));
    expect(kills).toHaveLength(1);
    expect(kills[0]?.headshot).toBe(true);
    expect(events.every((e) => typeof e.t === 'number' && typeof e.round === 'number')).toBe(true);
  });
});
