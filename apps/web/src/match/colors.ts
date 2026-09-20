import type { MatchLog } from '@idle-strike/engine';
import { PLAYER_COLORS, type PlayerColor } from '../store/db';

export type ViewMode = 'player' | 'hltv';

export const COLOR_VAR: Record<PlayerColor, string> = {
  yellow: 'var(--p-yellow)',
  purple: 'var(--p-purple)',
  green: 'var(--p-green)',
  blue: 'var(--p-blue)',
  orange: 'var(--p-orange)',
};
export const ENEMY = 'var(--enemy)';
export const COLOR_LABEL: Record<PlayerColor, string> = { yellow: 'amarelo', purple: 'roxo', green: 'verde', blue: 'azul', orange: 'laranja' };

export interface ColorScheme {
  mode: ViewMode;
  /** CSS colour per player id. */
  of: (id: string) => string;
  /** Round-dependent: side of a team index. */
  forSide: (side: 'CT' | 'T') => string;
}

/**
 * Player view (CS rule): the character in their colour, teammates in the other
 * four, every enemy red. HLTV view: CT blue / T orange by side.
 */
export function colorScheme(log: MatchLog, mode: ViewMode, me: string, myTeam: 0 | 1, myColor: PlayerColor, sides: Record<'CT' | 'T', 0 | 1>): ColorScheme {
  const teamOf = new Map(log.teams.flatMap((tm, i) => tm.players.map((p) => [p.id, i as 0 | 1] as const)));
  const sideColor = (side: 'CT' | 'T') => (side === 'CT' ? 'var(--ct)' : 'var(--t)');
  if (mode === 'hltv') {
    return { mode, of: (id) => sideColor(sides.CT === teamOf.get(id) ? 'CT' : 'T'), forSide: sideColor };
  }
  const map = new Map<string, string>();
  const rest = PLAYER_COLORS.filter((c) => c !== myColor);
  let k = 0;
  for (const p of log.teams[myTeam].players) {
    if (p.id === me) map.set(p.id, COLOR_VAR[myColor]);
    else map.set(p.id, COLOR_VAR[rest[k++ % rest.length] as PlayerColor]);
  }
  return { mode, of: (id) => map.get(id) ?? ENEMY, forSide: sideColor };
}

/** Resolves `var(--x)` to the computed value for canvas use. */
export function cssColor(v: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(v.trim());
  if (!m) return v;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1] as string).trim();
}
