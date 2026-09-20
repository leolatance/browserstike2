import type { MapDef } from '@idle-strike/engine';

/** Square window (radar px) around the map's mid contact area, with a margin. */
const MARGIN = 80;

/**
 * "Aim map": the parent map cropped to a square around the mid arena, so the
 * x1 radar shows the two duelists large instead of the whole layout. Every area
 * is kept (spawns and routes resolve by id); only the coordinates are translated,
 * so what falls outside the window is simply drawn off-canvas.
 */
export function aimMap(map: MapDef): MapDef {
  const mid = map.areas.find((a) => a.id === map.mid.contact);
  if (!mid) return map;
  const xs = mid.polygon.map((p) => p[0]);
  const ys = mid.polygon.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 2 * MARGIN;
  const x0 = cx - side / 2;
  const y0 = cy - side / 2;
  return {
    ...map,
    id: `${map.id}-aim`,
    name: `${map.name} · mid`,
    radar: { w: side, h: side },
    areas: map.areas.map((a) => ({ ...a, polygon: a.polygon.map(([x, y]) => [x - x0, y - y0] as [number, number]) })),
  };
}
