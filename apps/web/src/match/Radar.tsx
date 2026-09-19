import { useEffect, useRef } from 'react';
import type { MapDef } from '@idle-strike/engine';
import { snapshot, type RadarSnapshot } from './positions';
import type { ReplayPlayer, RoundIndex } from './replay';
import styles from './Radar.module.css';

interface Props {
  player: ReplayPlayer;
  map: MapDef;
  /** Player id to highlight (the user's character). */
  highlight: string;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Canvas radar. Subscribes to the player directly so it draws every frame. */
export function Radar({ player, map, highlight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let size = 0;
    const resize = () => {
      const w = Math.max(160, Math.floor(wrap.clientWidth));
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      size = w;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(w * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${w}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const colors = () => ({
      bg: cssVar('--radar-bg'),
      area: cssVar('--radar-area'),
      site: cssVar('--radar-area-site'),
      line: cssVar('--radar-line'),
      label: cssVar('--radar-label'),
      ct: cssVar('--ct'),
      t: cssVar('--t'),
      accent: cssVar('--accent'),
      danger: cssVar('--danger'),
      text: cssVar('--text-0'),
      smoke: cssVar('--smoke'),
      flash: cssVar('--flash'),
      molotov: cssVar('--molotov'),
      he: cssVar('--he'),
    });

    const draw = () => {
      if (!size) return;
      const st = player.getState();
      const ri: RoundIndex = player.current;
      const snap: RadarSnapshot = snapshot(player.log, map, ri, st.t);
      const c = colors();
      const k = size / map.radar.w;
      const P = (v: number) => v * k;

      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, size, size);

      // Areas
      const siteAreas = new Set([map.sites.A.plant, map.sites.B.plant]);
      for (const a of map.areas) {
        ctx.beginPath();
        a.polygon.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(P(x), P(y)) : ctx.lineTo(P(x), P(y))));
        ctx.closePath();
        ctx.fillStyle = siteAreas.has(a.id) ? c.site : c.area;
        ctx.fill();
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const a of map.areas) {
        const cx = a.polygon.reduce((s, p) => s + p[0], 0) / a.polygon.length;
        const cy = a.polygon.reduce((s, p) => s + p[1], 0) / a.polygon.length;
        if (siteAreas.has(a.id)) {
          ctx.fillStyle = c.label;
          ctx.font = `700 ${Math.max(14, size * 0.05)}px ${cssVar('--font')}`;
          ctx.globalAlpha = 0.55;
          ctx.fillText(a.id === map.sites.A.plant ? 'A' : 'B', P(cx), P(cy) - size * 0.03);
          ctx.globalAlpha = 1;
        } else if (size >= 300) {
          ctx.fillStyle = c.label;
          ctx.font = `500 ${Math.max(9, size * 0.021)}px ${cssVar('--font')}`;
          ctx.globalAlpha = 0.7;
          ctx.fillText(a.id === map.mid.contact ? 'MID' : a.name, P(cx), P(cy) + (siteAreas.has(a.id) ? size * 0.03 : 0));
          ctx.globalAlpha = 1;
        }
      }

      // Utility blobs
      for (const b of snap.blobs) {
        const fade = 1 - b.life;
        const r = b.kind === 'smoke' ? size * 0.07 : b.kind === 'molotov' ? size * 0.055 : size * 0.05 * (1 + b.life);
        ctx.beginPath();
        ctx.arc(P(b.x), P(b.y), r, 0, Math.PI * 2);
        ctx.fillStyle = b.kind === 'smoke' ? c.smoke : b.kind === 'flash' ? c.flash : b.kind === 'molotov' ? c.molotov : c.he;
        ctx.globalAlpha = b.kind === 'smoke' ? 0.35 + 0.5 * fade : fade;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Bomb
      if (snap.bomb) {
        const pulse = 0.6 + 0.4 * Math.abs(Math.sin(st.t * 3));
        const w = size * 0.05;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = c.danger;
        ctx.fillRect(P(snap.bomb.x) - w / 2, P(snap.bomb.y) - w / 3, w, (w * 2) / 3);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#111';
        ctx.font = `800 ${Math.max(8, size * 0.024)}px ${cssVar('--mono')}`;
        ctx.fillText('C4', P(snap.bomb.x), P(snap.bomb.y));
      }

      // Players
      const r = Math.max(5, size * 0.016);
      const roundOver = st.t >= ri.end.t;
      // Dead first so the X marks never hide a living dot.
      const ordered = [...snap.players.filter((p) => !p.alive), ...snap.players.filter((p) => p.alive)];
      for (const p of ordered) {
        const color = p.side === 'CT' ? c.ct : c.t;
        const x = P(p.x);
        const y = P(p.y);
        if (!p.alive) {
          if (roundOver) continue;
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x - r, y - r);
          ctx.lineTo(x + r, y + r);
          ctx.moveTo(x + r, y - r);
          ctx.lineTo(x - r, y + r);
          ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }
        if (p.heading) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + p.heading.x * r * 2.4, y + p.heading.y * r * 2.4);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.stroke();
        if (p.hitAt !== null && st.t - p.hitAt < 0.8) {
          ctx.beginPath();
          ctx.arc(x, y, r + 3 + (st.t - p.hitAt) * 6, 0, Math.PI * 2);
          ctx.strokeStyle = c.danger;
          ctx.globalAlpha = 1 - (st.t - p.hitAt) / 0.8;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (p.id === highlight) {
          ctx.beginPath();
          ctx.arc(x, y, r + 3, 0, Math.PI * 2);
          ctx.strokeStyle = c.text;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = c.text;
          ctx.font = `600 ${Math.max(9, size * 0.022)}px ${cssVar('--font')}`;
          ctx.fillText(p.nick, x, y - r - size * 0.02);
        }
      }
    };

    const unsubscribe = player.subscribe(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    return () => {
      unsubscribe();
      ro.disconnect();
    };
  }, [player, map, highlight]);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Radar da partida" />
    </div>
  );
}
