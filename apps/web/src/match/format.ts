export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function money(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
}

export const BUY_LABEL: Record<string, string> = {
  pistol: 'pistol',
  eco: 'eco',
  force: 'force',
  full: 'full buy',
};

export const REASON_LABEL: Record<string, string> = {
  elimination: 'eliminação',
  bomb: 'bomba explodiu',
  defuse: 'defuse',
  time: 'tempo',
};
