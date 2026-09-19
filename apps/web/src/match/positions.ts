/**
 * Derives what the radar shows at (round, t): interpolated positions from
 * `move` events, deaths, bomb, utility blobs.
 */
import { area as mapArea, isEvent, type AreaId, type MapDef, type MatchLog, type PlayerId, type Side, type UtilKind } from '@idle-strike/engine';
import type { RoundIndex } from './replay';

export interface Pt {
  x: number;
  y: number;
}

const centroidCache = new WeakMap<MapDef, Map<AreaId, Pt>>();

export function centroid(map: MapDef, id: AreaId): Pt {
  let cache = centroidCache.get(map);
  if (!cache) centroidCache.set(map, (cache = new Map()));
  let c = cache.get(id);
  if (!c) {
    const poly = mapArea(map, id).polygon;
    let x = 0;
    let y = 0;
    for (const [px, py] of poly) {
      x += px;
      y += py;
    }
    c = { x: x / poly.length, y: y / poly.length };
    cache.set(id, c);
  }
  return c;
}

export interface PlayerDot {
  id: PlayerId;
  nick: string;
  side: Side;
  team: 0 | 1;
  x: number;
  y: number;
  alive: boolean;
  /** Unit vector of the current/last displacement, null when idle. */
  heading: Pt | null;
  diedAt: number | null;
  hp: number;
  /** Time of the last damage taken, for the hit flash. */
  hitAt: number | null;
}

export interface UtilBlob {
  kind: UtilKind;
  x: number;
  y: number;
  /** 0 → just landed, 1 → about to vanish. */
  life: number;
}

export interface RadarSnapshot {
  players: PlayerDot[];
  bomb: Pt | null;
  plantedAt: number | null;
  blobs: UtilBlob[];
  sides: Record<Side, 0 | 1>;
}

const UTIL_TTL: Record<UtilKind, number> = { flash: 2.5, smoke: 18, molotov: 7, he: 1.5 };

/** Spread teammates standing in the same area so the dots don't overlap. */
function spread(index: number, radius = 40): Pt {
  const angle = (index / 5) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export function snapshot(log: MatchLog, map: MapDef, ri: RoundIndex, t: number): RadarSnapshot {
  const sides = ri.start.sides;
  const teamOf = new Map<PlayerId, 0 | 1>();
  const nickOf = new Map<PlayerId, string>();
  log.teams.forEach((team, idx) => {
    for (const p of team.players) {
      teamOf.set(p.id, idx as 0 | 1);
      nickOf.set(p.id, p.nick);
    }
  });

  const players: PlayerDot[] = [];
  const perTeamIndex: Record<number, number> = { 0: 0, 1: 0 };
  for (const team of log.teams) {
    for (const p of team.players) {
      const teamIdx = teamOf.get(p.id) as 0 | 1;
      const side: Side = sides.CT === teamIdx ? 'CT' : 'T';
      let pos = centroid(map, map.spawns[side]);
      let heading: Pt | null = null;
      let alive = true;
      let diedAt: number | null = null;
      let hp = 100;
      let hitAt: number | null = null;

      for (const e of ri.events) {
        if (e.t > t) break;
        if (isEvent(e, 'move') && e.player === p.id) {
          const from = centroid(map, e.from);
          const to = centroid(map, e.to);
          const end = e.t + e.duration;
          if (t >= end) {
            pos = to;
            heading = null;
          } else {
            const f = (t - e.t) / Math.max(1e-6, e.duration);
            pos = { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f };
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.hypot(dx, dy) || 1;
            heading = { x: dx / len, y: dy / len };
          }
        } else if (isEvent(e, 'damage') && e.victim === p.id) {
          hp = Math.max(0, hp - e.amount);
          hitAt = e.t;
        } else if (isEvent(e, 'kill') && e.victim === p.id) {
          alive = false;
          diedAt = e.t;
          pos = centroid(map, e.area);
          heading = null;
        }
      }
      const idx = perTeamIndex[teamIdx] as number;
      perTeamIndex[teamIdx] = idx + 1;
      const off = spread(idx, alive ? 40 : 22);
      players.push({
        id: p.id,
        nick: nickOf.get(p.id) ?? p.id,
        side,
        team: teamIdx,
        x: pos.x + off.x,
        y: pos.y + off.y,
        alive,
        heading,
        diedAt,
        hp,
        hitAt,
      });
    }
  }

  let bomb: Pt | null = null;
  let plantedAt: number | null = null;
  const blobs: UtilBlob[] = [];
  for (const e of ri.events) {
    if (e.t > t) break;
    if (isEvent(e, 'plant')) {
      bomb = centroid(map, map.sites[e.site].plant);
      plantedAt = e.t;
    } else if (isEvent(e, 'util')) {
      const ttl = UTIL_TTL[e.util];
      const age = t - e.t;
      if (age < ttl) {
        const c = centroid(map, e.area);
        blobs.push({ kind: e.util, x: c.x, y: c.y, life: age / ttl });
      }
    } else if (isEvent(e, 'defuse')) {
      bomb = null;
    }
  }

  return { players, bomb, plantedAt, blobs, sides };
}
