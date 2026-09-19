import { describe, expect, it } from 'vitest';
import { MAP01 } from '../src/data/maps/map01';
import { weapon } from '../src/data/weapons';
import { isEvent, type MatchEvent } from '../src/events';
import { Rng } from '../src/rng';
import { ROUND, simulateRound, type RoundParams } from '../src/round';
import { botTeams, roundTeam } from './helpers';

function params(seed: number, over: Partial<RoundParams> = {}): RoundParams {
  const [a, b] = botTeams(seed);
  return {
    round: 1,
    map: MAP01,
    rng: new Rng(seed),
    pistol: true,
    ct: roundTeam(a, 0, 'CT'),
    t: roundTeam(b, 1, 'T'),
    score: [0, 0],
    ...over,
  };
}

describe('simulateRound', () => {
  it('produces a well-formed, time-ordered event stream', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = params(seed, { pistol: seed % 3 === 0 });
      if (!p.pistol) for (const l of [...p.ct.players, ...p.t.players]) l.money = 2000 + (seed % 5) * 1500;
      const r = simulateRound(p);
      const ev = r.events;
      expect(ev[0]?.type).toBe('roundStart');
      expect(ev[ev.length - 1]?.type).toBe('roundEnd');
      for (let i = 1; i < ev.length; i++) expect(ev[i]!.t).toBeGreaterThanOrEqual(ev[i - 1]!.t);
      for (const e of ev) {
        expect(e.round).toBe(1);
        if (e.type !== 'duel') expect(Number.isInteger(e.t)).toBe(true);
        expect(e.t).toBeGreaterThanOrEqual(0);
      }
      expect(r.duration).toBeLessThanOrEqual(ROUND.FREEZETIME + ROUND.TIME + ROUND.BOMB_TIMER);
      expect(['CT', 'T']).toContain(r.winner);
      expect(['elimination', 'bomb', 'defuse', 'time']).toContain(r.reason);
      if (r.reason === 'bomb' || r.reason === 'defuse') expect(r.planted).toBe(true);
      if (r.reason === 'bomb') expect(r.winner).toBe('T');
      if (r.reason === 'defuse' || r.reason === 'time') expect(r.winner).toBe('CT');
      if (r.reason === 'time') expect(r.planted).toBe(false);
    }
  });

  it('kills, deaths, survivors and money are consistent', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = params(seed);
      const before = Object.fromEntries([...p.ct.players, ...p.t.players].map((l) => [l.id, l.money]));
      const r = simulateRound(p);
      const kills = r.events.filter((e) => isEvent(e, 'kill'));
      const deaths = Object.values(r.stats).filter((s) => s.died).length;
      const statKills = Object.values(r.stats).reduce((s, x) => s + x.kills, 0);
      expect(kills.length).toBe(deaths);
      expect(statKills).toBe(deaths);
      expect(r.survivors.length).toBe(10 - deaths);
      // Nobody dies twice, nobody kills after dying.
      const dead = new Set<string>();
      for (const k of kills) {
        expect(dead.has(k.victim)).toBe(false);
        expect(dead.has(k.attacker)).toBe(false);
        dead.add(k.victim);
      }
      // At least one side must be fully dead unless bomb/time decided it.
      if (r.reason === 'elimination') expect(deaths).toBeGreaterThanOrEqual(5);
      // Money: purchases ≤ 800 on pistol; killers got rewards.
      for (const l of [...p.ct.players, ...p.t.players]) {
        const spent = r.events.filter((e) => isEvent(e, 'buy') && e.player === l.id).reduce((s, e) => s + (e as { spent: number }).spent, 0);
        expect(spent).toBeLessThanOrEqual(800);
        const rewards = kills.filter((k) => k.attacker === l.id).reduce((s, k) => s + weapon(k.weapon).killReward, 0);
        expect(l.money).toBe(Math.min(16000, before[l.id]! - spent + rewards));
      }
    }
  });

  it('every T moves toward the target site; every player has radar moves', () => {
    const r = simulateRound(params(11));
    const moves = r.events.filter((e) => isEvent(e, 'move'));
    const target = r.call.endsWith('A') ? 'A' : r.call.endsWith('B') ? 'B' : null;
    for (const l of r.events.filter((e) => isEvent(e, 'roundStart')).flatMap((e) => Object.keys((e as { money: Record<string, number> }).money))) {
      expect(moves.some((m) => m.player === l)).toBe(true);
    }
    if (target) {
      const plant = MAP01.sites[target].plant;
      const arrivedOrDied = r.events.some((e) => (isEvent(e, 'move') && e.to === plant) || isEvent(e, 'kill'));
      expect(arrivedOrDied).toBe(true);
    }
    // Plant happens at the called site.
    const plant = r.events.find((e) => isEvent(e, 'plant'));
    if (plant && target) expect(plant.site).toBe(target);
  });

  it('a forced full buy vs eco produces rifles vs pistols', () => {
    const p = params(5, { pistol: false, forceBuy: { CT: 'full', T: 'eco' } });
    for (const l of p.ct.players) l.money = 10000;
    for (const l of p.t.players) l.money = 800;
    const r = simulateRound(p);
    expect(r.buy).toEqual({ CT: 'full', T: 'eco' });
    const ctBuys = r.events.filter((e) => isEvent(e, 'buy') && p.ct.players.some((l) => l.id === e.player));
    expect(ctBuys).toHaveLength(5);
    for (const b of ctBuys) expect(['rifle', 'awp']).toContain(weapon((b as { weapon: string }).weapon).class);
    const tBuys = r.events.filter((e) => isEvent(e, 'buy') && p.t.players.some((l) => l.id === e.player));
    expect(tBuys).toHaveLength(5);
    expect(tBuys.every((b) => (b as { spent: number }).spent === 0)).toBe(true);
  });

  it('is deterministic', () => {
    const run = () => JSON.stringify(simulateRound(params(42)));
    expect(run()).toBe(run());
    expect(JSON.stringify(simulateRound(params(43)))).not.toBe(run());
  });

  it('never loops forever and both sides win sometimes', () => {
    let ct = 0;
    let t = 0;
    const reasons = new Set<string>();
    for (let seed = 1; seed <= 500; seed++) {
      const p = params(seed, { pistol: false });
      for (const l of [...p.ct.players, ...p.t.players]) l.money = 5000;
      const r = simulateRound(p);
      reasons.add(r.reason);
      if (r.winner === 'CT') ct++;
      else t++;
    }
    expect(ct).toBeGreaterThan(100);
    expect(t).toBeGreaterThan(100);
    expect(reasons.has('bomb') || reasons.has('defuse')).toBe(true);
    expect(reasons.has('elimination')).toBe(true);
  });

  it('freezetime: buys before freezetimeEnd, calls right after, no action before', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = simulateRound(params(seed));
      const start = r.events.find((e) => isEvent(e, 'roundStart'))!;
      expect(start.freezetimeEnd).toBe(ROUND.FREEZETIME);
      const buys = r.events.filter((e) => isEvent(e, 'buy'));
      expect(buys).toHaveLength(10);
      expect(buys.every((b) => b.t < start.freezetimeEnd)).toBe(true);
      const action = r.events.filter((e) => e.type === 'move' || e.type === 'kill' || e.type === 'damage' || e.type === 'duel' || e.type === 'util');
      expect(action.every((e) => e.t >= start.freezetimeEnd)).toBe(true);
    }
  });

  it('every kill/duel-damage references a duel emitted ~0.8s earlier, exactly once', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = params(seed, { pistol: false });
      for (const l of [...p.ct.players, ...p.t.players]) l.money = 6000;
      const r = simulateRound(p);
      const duels = r.events.filter((e) => isEvent(e, 'duel'));
      const ids = duels.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
      const byId = new Map(duels.map((d) => [d.id, d]));
      for (const e of r.events) {
        if (isEvent(e, 'kill')) {
          expect(e.duel).toBeDefined();
          const d = byId.get(e.duel!)!;
          expect(d).toBeDefined();
          expect(e.t).toBeGreaterThanOrEqual(d.t);
          expect([d.attacker, d.defender]).toContain(e.victim);
        }
        if (isEvent(e, 'damage') && e.duel) expect(byId.has(e.duel)).toBe(true);
      }
      // A duel without a resolution is impossible.
      for (const d of duels) {
        const resolved = r.events.some((e) => (isEvent(e, 'kill') || isEvent(e, 'damage')) && e.duel === d.id);
        expect(resolved).toBe(true);
      }
    }
  });

  it('defuseStart precedes defuse; defuseCancel only after a start', () => {
    let starts = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const p = params(seed, { pistol: false });
      for (const l of [...p.ct.players, ...p.t.players]) l.money = 6000;
      const r = simulateRound(p);
      let open: string | null = null;
      for (const e of r.events) {
        if (isEvent(e, 'defuseStart')) {
          open = e.player;
          starts++;
          expect([5, 10]).toContain(e.duration);
        } else if (isEvent(e, 'defuseCancel')) {
          expect(open).toBe(e.player);
          open = null;
        } else if (isEvent(e, 'defuse')) {
          expect(open).toBe(e.player);
          open = null;
        }
      }
      if (r.reason === 'defuse') expect(r.events.some((e) => isEvent(e, 'defuseStart'))).toBe(true);
    }
    expect(starts).toBeGreaterThan(0);
  });

  it('molotov and HE are used and never kill', () => {
    let molly = 0;
    let he = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const p = params(seed, { pistol: false });
      for (const l of [...p.ct.players, ...p.t.players]) l.money = 8000;
      const r = simulateRound(p);
      for (const e of r.events) {
        if (isEvent(e, 'util') && e.util === 'molotov') molly++;
        if (isEvent(e, 'util') && e.util === 'he') he++;
        if (isEvent(e, 'kill')) expect(['molotov', 'he']).not.toContain(e.weapon);
      }
    }
    expect(molly).toBeGreaterThan(0);
    expect(he).toBeGreaterThan(0);
  });

  it('call and setup events are emitted right after freezetime and valid', () => {
    const r = simulateRound(params(3));
    const calls = r.events.filter((e): e is Extract<MatchEvent, { type: 'call' }> => e.type === 'call');
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.t === ROUND.FREEZETIME)).toBe(true);
    expect(calls.map((c) => c.side).sort()).toEqual(['CT', 'T']);
  });
});
