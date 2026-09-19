import { describe, expect, it } from 'vitest';
import { MAP01 } from '../src/data/maps/map01';
import { isEvent } from '../src/events';
import { ctFor, simulateMatch } from '../src/match';
import { botTeams } from './helpers';

describe('simulateMatch', () => {
  it('plays to 13 (or overtime) with a consistent log', () => {
    let sawOvertime = false;
    for (let seed = 1; seed <= 60; seed++) {
      const log = simulateMatch({ map: MAP01, teams: botTeams(seed) }, seed);
      const [a, b] = log.score;
      const w = log.winner;
      const winnerScore = log.score[w];
      const loserScore = log.score[w === 0 ? 1 : 0];
      expect(winnerScore).toBeGreaterThan(loserScore);
      if (!log.overtime) {
        expect(winnerScore).toBe(13);
        expect(loserScore).toBeLessThanOrEqual(11);
      } else {
        sawOvertime = true;
        expect(winnerScore).toBeGreaterThanOrEqual(16);
        expect((winnerScore - 13) % 3).toBe(0);
        expect(winnerScore - loserScore).toBeGreaterThanOrEqual(2);
      }
      expect(log.rounds).toHaveLength(a + b);
      expect(log.rounds[log.rounds.length - 1]?.score).toEqual(log.score);
      // Every round has exactly one start and one end, numbered contiguously.
      for (let r = 1; r <= a + b; r++) {
        const starts = log.events.filter((e) => e.round === r && e.type === 'roundStart');
        const ends = log.events.filter((e) => e.round === r && e.type === 'roundEnd');
        expect(starts).toHaveLength(1);
        expect(ends).toHaveLength(1);
      }
      expect(log.mapId).toBe('baixada');
      expect(log.seed).toBe(seed);
    }
    expect(sawOvertime).toBe(true);
  });

  it('swaps sides at halftime and flags pistol rounds', () => {
    const log = simulateMatch({ map: MAP01, teams: botTeams(2) }, 2);
    const starts = log.events.filter((e) => isEvent(e, 'roundStart'));
    expect(starts[0]?.sides).toEqual({ CT: 0, T: 1 });
    expect(starts[0]?.pistol).toBe(true);
    expect(starts[11]?.sides).toEqual({ CT: 0, T: 1 });
    expect(starts[12]?.sides).toEqual({ CT: 1, T: 0 });
    expect(starts[12]?.pistol).toBe(true);
    expect(starts[1]?.pistol).toBe(false);
    // Half starts reset money to $800.
    for (const idx of [0, 12]) for (const m of Object.values(starts[idx]!.money)) expect(m).toBe(800);
    expect(ctFor(1, 12, 3, 1)).toBe(1);
    expect(ctFor(13, 12, 3, 1)).toBe(0);
    expect(ctFor(25, 12, 3, 0)).toBe(1);
    expect(ctFor(28, 12, 3, 0)).toBe(0);
  });

  it('money stays within [0, 16000] and stats reconcile with the event log', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const log = simulateMatch({ map: MAP01, teams: botTeams(seed) }, seed);
      for (const e of log.events) {
        if (isEvent(e, 'roundStart')) for (const m of Object.values(e.money)) {
          expect(m).toBeGreaterThanOrEqual(0);
          expect(m).toBeLessThanOrEqual(16000);
        }
      }
      const kills = log.events.filter((e) => isEvent(e, 'kill'));
      const totalKills = log.stats.reduce((s, p) => s + p.kills, 0);
      const totalDeaths = log.stats.reduce((s, p) => s + p.deaths, 0);
      expect(totalKills).toBe(kills.length);
      expect(totalDeaths).toBe(kills.length);
      const rounds = log.score[0] + log.score[1];
      for (const p of log.stats) {
        expect(p.rounds).toBe(rounds);
        expect(p.deaths).toBeLessThanOrEqual(rounds);
        expect(p.kastRounds).toBeLessThanOrEqual(rounds);
        expect(Number.isFinite(p.rating)).toBe(true);
        expect(p.rating).toBeGreaterThanOrEqual(0);
        expect(p.headshots).toBeLessThanOrEqual(p.kills);
      }
      expect(log.stats).toHaveLength(10);
    }
  });

  it('a much stronger team wins almost always', () => {
    let wins = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const log = simulateMatch({ map: MAP01, teams: botTeams(seed, 85, 30) }, seed);
      if (log.winner === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(38);
  });

  it('respects startingCT and custom mr', () => {
    const log = simulateMatch({ map: MAP01, teams: botTeams(9), startingCT: 1, mr: 3, otMr: 1 }, 9);
    expect(log.startingSides).toEqual({ CT: 1, T: 0 });
    const first = log.events.find((e) => isEvent(e, 'roundStart'))!;
    expect(first.sides).toEqual({ CT: 1, T: 0 });
    expect(Math.max(...log.score)).toBeGreaterThanOrEqual(4);
  });
});
