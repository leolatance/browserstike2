/**
 * Live scoreboard numbers up to (round, t), computed from the event log with the
 * engine's own rating formula.
 */
import { isEvent, ratingBreakdown, type MatchLog, type PlayerId, type Side } from '@idle-strike/engine';
import type { RoundIndex } from './replay';

export interface LiveRow {
  id: PlayerId;
  nick: string;
  cls: string;
  team: 0 | 1;
  side: Side;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  /** null until a round has been completed. */
  rating: number | null;
  alive: boolean;
}

interface Acc {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  kastRounds: number;
}

export function liveStats(log: MatchLog, rounds: RoundIndex[], roundIdx: number, t: number): LiveRow[] {
  const acc = new Map<PlayerId, Acc>();
  const teamOf = new Map<PlayerId, 0 | 1>();
  for (const [idx, team] of log.teams.entries()) {
    for (const p of team.players) {
      teamOf.set(p.id, idx as 0 | 1);
      acc.set(p.id, { kills: 0, deaths: 0, assists: 0, damage: 0, kastRounds: 0 });
    }
  }

  const current = rounds[roundIdx];
  if (!current) return [];
  const aliveNow = new Set<PlayerId>(acc.keys());
  let completedRounds = 0;

  for (let i = 0; i <= roundIdx; i++) {
    const ri = rounds[i] as RoundIndex;
    const isCurrent = i === roundIdx;
    const limit = isCurrent ? t : Infinity;
    const complete = !isCurrent || t >= ri.end.t;
    const killed = new Set<PlayerId>();
    const assisted = new Set<PlayerId>();
    const died = new Set<PlayerId>();
    const traded = new Set<PlayerId>();
    let lastKill: { attacker: PlayerId; victim: PlayerId } | null = null;

    for (const e of ri.events) {
      if (e.t > limit) break;
      if (isEvent(e, 'kill')) {
        const a = acc.get(e.attacker);
        const v = acc.get(e.victim);
        if (a) a.kills++;
        if (v) v.deaths++;
        killed.add(e.attacker);
        died.add(e.victim);
        if (isCurrent) aliveNow.delete(e.victim);
        if (e.trade && lastKill && lastKill.attacker === e.victim) traded.add(lastKill.victim);
        lastKill = { attacker: e.attacker, victim: e.victim };
      } else if (isEvent(e, 'damage')) {
        const a = acc.get(e.attacker);
        if (a) a.damage += e.amount;
      } else if (isEvent(e, 'assist')) {
        const a = acc.get(e.player);
        if (a) a.assists++;
        assisted.add(e.player);
      }
    }
    if (complete) {
      completedRounds++;
      for (const [id, a] of acc) {
        if (killed.has(id) || assisted.has(id) || !died.has(id) || traded.has(id)) a.kastRounds++;
      }
    }
  }

  const roundsForRate = Math.max(1, completedRounds);
  const rows: LiveRow[] = [];
  for (const team of log.teams) {
    for (const p of team.players) {
      const a = acc.get(p.id) as Acc;
      const teamIdx = teamOf.get(p.id) as 0 | 1;
      const b = ratingBreakdown({ ...a, rounds: roundsForRate });
      rows.push({
        id: p.id,
        nick: p.nick,
        cls: p.class,
        team: teamIdx,
        side: current.start.sides.CT === teamIdx ? 'CT' : 'T',
        kills: a.kills,
        deaths: a.deaths,
        assists: a.assists,
        adr: completedRounds === 0 ? 0 : b.adr,
        rating: completedRounds === 0 ? null : b.rating,
        alive: aliveNow.has(p.id),
      });
    }
  }
  return rows;
}
