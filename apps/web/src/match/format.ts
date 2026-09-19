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

export const T_CALL_LABEL: Record<string, string> = {
  rushA: 'rush A',
  rushB: 'rush B',
  splitA: 'split A',
  splitB: 'split B',
  default: 'default',
  fake: 'fake',
};

export const CT_SETUP_LABEL: Record<string, string> = {
  default: 'padrão',
  stackA: 'stack A',
  stackB: 'stack B',
  aggressive: 'agressivo',
};

export const REASON_LABEL: Record<string, string> = {
  elimination: 'eliminação',
  bomb: 'bomba explodiu',
  defuse: 'defuse',
  time: 'tempo',
};
