import { useEffect, useState } from 'react';

/** Solid colour derived from the nick (fallback when there is no photo). */
export function nickColor(nick: string): string {
  let h = 0;
  for (const ch of nick.toLowerCase()) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 55% 42%)`;
}

/** Profile photo, or initials over a solid nick-derived colour. */
export function Avatar({ photo, nick, size = 56 }: { photo?: Blob | null; nick: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(photo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  const initials = nick
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();
  const base: React.CSSProperties = { width: size, height: size, borderRadius: '50%', flex: '0 0 auto', overflow: 'hidden' };
  if (url) return <img src={url} alt={`Foto de ${nick}`} style={{ ...base, objectFit: 'cover', display: 'block' }} />;
  return (
    <div
      aria-label={`Iniciais de ${nick}`}
      style={{ ...base, background: nickColor(nick), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.36, color: '#0c0f13' }}
    >
      {initials || '?'}
    </div>
  );
}
