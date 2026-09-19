import { weapon, type WeaponClass } from '@idle-strike/engine';

/** Placeholder grey silhouettes per category. Real icons are original art, later. */
const PATHS: Record<WeaponClass, string> = {
  pistol: 'M2 4h14v3H9l-1 4H5l1-4H2z',
  smg: 'M1 4h20v3h-4v2h-3v-2H9l-1 4H5l1-4H1z',
  rifle: 'M0 5h26l2 1-2 1h-6v2h-3V7h-4l-1 4H9l1-4H0z',
  awp: 'M0 5h28l1 1-1 1h-8v3h-3V7h-5l-1 4H8l1-4H4v2H2V7H0z',
  shotgun: 'M0 5h24v2h-6l-1 4h-3l1-4H0z',
  knife: 'M3 8l10-5 3 1-8 6H3z',
};

export function WeaponIcon({ id, size = 26 }: { id: string; size?: number }) {
  const cls = weapon(id).class;
  return (
    <svg width={size} height={(size * 12) / 30} viewBox="0 0 30 12" aria-label={weapon(id).name} role="img" style={{ display: 'block' }}>
      <path d={PATHS[cls]} fill="#8b95a1" />
    </svg>
  );
}
