import { AVATAR_COLORS } from '../store/character';

/** Placeholder avatar: coloured disc with the nick's initials. Real portraits later. */
export function Avatar({ slot, nick, size = 56 }: { slot: number; nick: string; size?: number }) {
  const color = AVATAR_COLORS[slot % AVATAR_COLORS.length];
  const initials = nick
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      aria-label={`Avatar ${slot + 1}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${color}, #111 130%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: size * 0.34,
        color: '#0c0f13',
        flex: '0 0 auto',
      }}
    >
      {initials || slot + 1}
    </div>
  );
}
