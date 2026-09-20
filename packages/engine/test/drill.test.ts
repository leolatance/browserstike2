import { describe, expect, it } from 'vitest';
import { MAP01 } from '../src/data/maps/map01';
import { RETAKE_CALLS, simulateDeathmatch, simulateScenario, type ScenarioKind } from '../src/drill';
import { isEvent } from '../src/events';
import { makePlayer, uniformAttrs } from '../src/player';
import { botTeams } from './helpers';

const me = () => makePlayer('a1', 'me', 'rifler', uniformAttrs(30));
const cfg = () => ({ map: MAP01, me: me(), botAvg: 30 });

describe('deathmatch', () => {
  it('is deterministic and well-formed', () => {
    const teams = botTeams(1);
    const a = JSON.stringify(simulateDeathmatch({ map: MAP01, teams }, 5, 60));
    const b = JSON.stringify(simulateDeathmatch({ map: MAP01, teams }, 5, 60));
    expect(a).toBe(b);
    const log = simulateDeathmatch({ map: MAP01, teams }, 5, 60);
    expect(log.drill).toBe('dm');
    expect(log.events[0]?.type).toBe('roundStart');
    expect(log.events[log.events.length - 1]?.type).toBe('roundEnd');
    for (let i = 1; i < log.events.length; i++) expect(log.events[i]!.t).toBeGreaterThanOrEqual(log.events[i - 1]!.t);
    // Every kill has a duel, every death a respawn (or the round ended).
    const kills = log.events.filter((e) => isEvent(e, 'kill'));
    for (const k of kills) expect(k.duel).toBeDefined();
    const respawns = log.events.filter((e) => isEvent(e, 'respawn'));
    expect(respawns.length).toBeGreaterThanOrEqual(10 + kills.length - 10);
    expect(log.stats.reduce((s, p) => s + p.kills, 0)).toBe(kills.length);
  });

  it('3 minutes → 40–80 kills in total and 25–40 duels for a player', () => {
    let kills = 0;
    let duels = 0;
    const n = 40;
    for (let i = 0; i < n; i++) {
      const teams = botTeams(100 + i, 30, 30);
      const log = simulateDeathmatch({ map: MAP01, teams }, 100 + i, 180);
      kills += log.events.filter((e) => isEvent(e, 'kill')).length;
      duels += log.events.filter((e) => isEvent(e, 'duel') && (e.attacker === 'a1' || e.defender === 'a1')).length;
    }
    console.log(`[drill] DM 3min: kills ${(kills / n).toFixed(1)} · duels for a1 ${(duels / n).toFixed(1)}`);
    expect(kills / n).toBeGreaterThanOrEqual(40);
    expect(kills / n).toBeLessThanOrEqual(80);
    expect(duels / n).toBeGreaterThanOrEqual(25);
    expect(duels / n).toBeLessThanOrEqual(40);
  });
});

describe('scenarios', () => {
  it('every kind runs, is deterministic and keeps the character in the log', () => {
    for (const kind of ['aim1v1', 'peek', 'rush', 'retake2v2', 'retake3v2', 'execute'] as ScenarioKind[]) {
      const r1 = simulateScenario(kind, cfg(), 7);
      const r2 = simulateScenario(kind, cfg(), 7);
      expect(JSON.stringify(r1.log)).toBe(JSON.stringify(r2.log));
      expect(r1.log.drill).toBe(kind);
      expect(r1.log.teams[0].players[0]?.id).toBe('a1');
      expect(r1.timeSec).toBeGreaterThan(0);
      expect(r1.timeSec).toBeLessThanOrEqual(30);
      expect(r1.duelsWon).toBeLessThanOrEqual(r1.duels);
      if (kind.startsWith('retake')) {
        expect(RETAKE_CALLS).toContain(r1.call);
        expect(RETAKE_CALLS).toContain(r1.correctCall);
      }
    }
  });

  it('aim1v1 with equal attributes is won ~50% and gives 3–7 duels', () => {
    let won = 0;
    let duels = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const r = simulateScenario('aim1v1', cfg(), 1000 + i);
      if (r.won) won++;
      duels += r.duels;
    }
    console.log(`[drill] aim1v1: won ${((100 * won) / n).toFixed(1)}% · duels ${(duels / n).toFixed(1)}`);
    expect(won / n).toBeGreaterThan(0.4);
    expect(won / n).toBeLessThan(0.6);
    expect(duels / n).toBeGreaterThanOrEqual(3);
    expect(duels / n).toBeLessThanOrEqual(7);
  });

  it('the right retake call wins more than the wrong one', () => {
    let right = 0;
    let wrong = 0;
    let nRight = 0;
    let nWrong = 0;
    for (let i = 0; i < 600; i++) {
      const call = RETAKE_CALLS[i % 3]!;
      const r = simulateScenario('retake2v2', cfg(), 2000 + i, call);
      if (r.call === r.correctCall) {
        nRight++;
        if (r.won) right++;
      } else {
        nWrong++;
        if (r.won) wrong++;
      }
    }
    console.log(`[drill] retake2v2: right call ${((100 * right) / nRight).toFixed(0)}% · wrong ${((100 * wrong) / nWrong).toFixed(0)}%`);
    expect(right / nRight).toBeGreaterThan(wrong / nWrong + 0.05);
  });
});
