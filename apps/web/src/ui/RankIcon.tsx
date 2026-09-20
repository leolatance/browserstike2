import { RANKS, rankOf } from '@idle-strike/engine';

const TIER_COLORS = ['#8b95a1', '#9aa5b1', '#b7c1cc', '#5aa9ff', '#5bd97a', '#f2d94e', '#ff9a3c', '#b57bff', '#ff5fa6', '#ffc93c'];

/** Shield with the tier number; colour climbs with the tier. Original art, code only. */
export function RankIcon({ mmr, size = 28, withName = false }: { mmr: number; size?: number; withName?: boolean }) {
  const r = rankOf(mmr);
  const color = TIER_COLORS[r.tier - 1] ?? '#8b95a1';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title={`${r.name} · ${mmr} MMR`}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-label={r.name} role="img">
        <path d="M16 2 L28 7 V16 C28 23 22 28 16 30 C10 28 4 23 4 16 V7 Z" fill="#12161c" stroke={color} strokeWidth="2.5" />
        <text x="16" y="21" textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontWeight="800" fontSize="13" fill={color}>
          {r.tier}
        </text>
      </svg>
      {withName && <b style={{ color }}>{r.name}</b>}
    </span>
  );
}

export { RANKS };
