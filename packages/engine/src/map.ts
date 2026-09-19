/**
 * Map schema (GDD 11) and route pathfinding. Maps are parodies: layout
 * *inspired* by classic two-site maps, with original names and radars.
 */
import type { AreaId, Side, SiteId } from './events';
import type { Range } from './data/weapons';

export interface MapArea {
  id: AreaId;
  /** Display name (pt-BR). */
  name: string;
  /** Polygon in radar pixel coordinates. */
  polygon: [number, number][];
  range: Range;
}

export interface MapRoute {
  from: AreaId;
  to: AreaId;
  /** Seconds to traverse at base speed (bidirectional). */
  time: number;
  range: Range;
}

export interface MapSite {
  /** Area where the bomb is planted / the site fight happens. */
  plant: AreaId;
  /** Entrances Ts use; index 0 is the "main" one, 1 the secondary (split). */
  entrances: [AreaId, AreaId];
  /** Where the CT defenders stand by default. */
  holds: AreaId[];
  /** Area an aggressive CT pushes to for early contact. */
  forward: AreaId;
}

export interface MapDef {
  id: string;
  name: string;
  radar: { w: number; h: number };
  areas: MapArea[];
  routes: MapRoute[];
  spawns: Record<Side, AreaId>;
  sites: Record<SiteId, MapSite>;
  mid: {
    /** Area where T mid-control players stand. */
    t: AreaId;
    /** Area where the CT mid player stands. */
    ct: AreaId;
    /** Area where mid duels are resolved. */
    contact: AreaId;
  };
}

export interface PathResult {
  path: AreaId[];
  time: number;
}

/** Dijkstra over map routes. Returns null when `to` is unreachable. */
export function shortestPath(map: MapDef, from: AreaId, to: AreaId): PathResult | null {
  if (from === to) return { path: [from], time: 0 };
  const dist = new Map<AreaId, number>();
  const prev = new Map<AreaId, AreaId>();
  const visited = new Set<AreaId>();
  dist.set(from, 0);

  const neighbors = adjacency(map);

  while (true) {
    let current: AreaId | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null) return null;
    if (current === to) break;
    visited.add(current);
    for (const edge of neighbors.get(current) ?? []) {
      const nd = best + edge.time;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, current);
      }
    }
  }

  const path: AreaId[] = [to];
  let cur = to;
  while (cur !== from) {
    const p = prev.get(cur);
    if (p === undefined) return null;
    path.unshift(p);
    cur = p;
  }
  return { path, time: dist.get(to) ?? 0 };
}

const ADJ_CACHE = new WeakMap<MapDef, Map<AreaId, { to: AreaId; time: number; range: Range }[]>>();

function adjacency(map: MapDef) {
  let adj = ADJ_CACHE.get(map);
  if (adj) return adj;
  adj = new Map();
  for (const r of map.routes) {
    if (!adj.has(r.from)) adj.set(r.from, []);
    if (!adj.has(r.to)) adj.set(r.to, []);
    adj.get(r.from)!.push({ to: r.to, time: r.time, range: r.range });
    adj.get(r.to)!.push({ to: r.from, time: r.time, range: r.range });
  }
  ADJ_CACHE.set(map, adj);
  return adj;
}

export function area(map: MapDef, id: AreaId): MapArea {
  const a = map.areas.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown area '${id}' on map '${map.id}'`);
  return a;
}

export function areaRange(map: MapDef, id: AreaId): Range {
  return area(map, id).range;
}

/** Validates internal consistency. Throws with a readable message. */
export function validateMap(map: MapDef): void {
  const ids = new Set<AreaId>();
  for (const a of map.areas) {
    if (ids.has(a.id)) throw new Error(`Duplicate area '${a.id}'`);
    ids.add(a.id);
    if (a.polygon.length < 3) throw new Error(`Area '${a.id}' needs >= 3 points`);
    for (const [x, y] of a.polygon) {
      if (x < 0 || y < 0 || x > map.radar.w || y > map.radar.h) throw new Error(`Area '${a.id}' point outside radar`);
    }
  }
  for (const r of map.routes) {
    if (!ids.has(r.from) || !ids.has(r.to)) throw new Error(`Route ${r.from}->${r.to} references unknown area`);
    if (r.time <= 0) throw new Error(`Route ${r.from}->${r.to} must take time`);
  }
  const check = (id: AreaId, what: string) => {
    if (!ids.has(id)) throw new Error(`${what} references unknown area '${id}'`);
  };
  check(map.spawns.CT, 'CT spawn');
  check(map.spawns.T, 'T spawn');
  check(map.mid.t, 'mid.t');
  check(map.mid.ct, 'mid.ct');
  check(map.mid.contact, 'mid.contact');
  for (const site of ['A', 'B'] as SiteId[]) {
    const s = map.sites[site];
    check(s.plant, `site ${site} plant`);
    check(s.forward, `site ${site} forward`);
    s.entrances.forEach((e) => check(e, `site ${site} entrance`));
    s.holds.forEach((h) => check(h, `site ${site} hold`));
    for (const side of ['CT', 'T'] as Side[]) {
      if (!shortestPath(map, map.spawns[side], s.plant)) throw new Error(`${side} spawn cannot reach site ${site}`);
    }
  }
}
