import { useEffect, useRef, useState } from 'react';
import { MAP01, type RetakeCall, type SiteId } from '@idle-strike/engine';
import { centroid } from '../match/positions';
import { DUEL_TARGET, DuelTargetGame } from '../minigames/duelTarget';
import styles from './prompts.module.css';

export const CALL_LABEL: Record<RetakeCall, string> = { padrao: 'Padrão', flanco: 'Flanco', agressivo: 'Agressivo' };
const CALL_HINT: Record<RetakeCall, string> = { padrao: 'entram juntos pelo caminho normal', flanco: 'um vem pela outra entrada, chega depois', agressivo: 'correm pra dentro antes que se assentem' };

/** Tático: 3 calls, 5s to pick; no pick = padrão. */
export function CallPrompt({ title, onPick }: { title: string; onPick: (call: RetakeCall) => void }) {
  const [left, setLeft] = useState(5);
  const picked = useRef(false);
  useEffect(() => {
    const id = setInterval(() => setLeft((v) => v - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left <= 0 && !picked.current) {
      picked.current = true;
      onPick('padrao');
    }
  }, [left, onPick]);
  return (
    <div className={styles.prompt}>
      <div className={styles.head}>
        <b>{title}</b>
        <span className="mono">{Math.max(0, left)}s</span>
      </div>
      <div className={styles.hint}>Qual é a call?</div>
      {(['padrao', 'flanco', 'agressivo'] as RetakeCall[]).map((c) => (
        <button
          key={c}
          className={styles.call}
          onClick={() => {
            if (picked.current) return;
            picked.current = true;
            onPick(c);
          }}
        >
          <b>{CALL_LABEL[c]}</b>
          <span>{CALL_HINT[c]}</span>
        </button>
      ))}
    </div>
  );
}

/** Utilitária: tap the smoke spot on the radar within 1.5s. */
export function LineupPrompt({ site, onDone }: { site: SiteId; onDone: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = Math.min(320, Math.floor(canvas.parentElement?.clientWidth ?? 320) - 24);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = size / MAP01.radar.w;
    const target = centroid(MAP01, MAP01.sites[site].plant);
    const nx = target.x / MAP01.radar.w;
    const ny = target.y / MAP01.radar.h;
    const game = new DuelTargetGame(1500);
    // The point appears after a short beat so reaction is measured from its appearance.
    let raf = 0;
    const startAt = performance.now() + 700;
    let spawned = false;
    const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = css('--radar-bg');
      ctx.fillRect(0, 0, size, size);
      for (const a of MAP01.areas) {
        ctx.beginPath();
        a.polygon.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * k, y * k) : ctx.lineTo(x * k, y * k)));
        ctx.closePath();
        ctx.fillStyle = css('--radar-area');
        ctx.fill();
        ctx.strokeStyle = css('--radar-line');
        ctx.stroke();
      }
      const now = performance.now();
      if (!spawned && now >= startAt) {
        spawned = true;
        game.spawn(`lineup-${site}`, now, null, { x: nx, y: ny });
      }
      const tg = game.target;
      if (tg) {
        const life = (now - tg.spawnedAt) / 1500;
        const r = DUEL_TARGET.RADIUS * size;
        ctx.strokeStyle = css('--accent');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tg.x * size, tg.y * size, r * (1.4 - 0.4 * life), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = css('--accent');
        ctx.beginPath();
        ctx.arc(tg.x * size, tg.y * size, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (game.tick(now) && !done.current) {
        done.current = true;
        onDone(0);
        return;
      }
      raf = requestAnimationFrame(draw);
    };
    const onPointer = (ev: PointerEvent) => {
      ev.preventDefault();
      const tg = game.target;
      if (!tg || done.current) return;
      const rect = canvas.getBoundingClientRect();
      const d = Math.hypot(ev.clientX - rect.left - tg.x * size, ev.clientY - rect.top - tg.y * size) / (DUEL_TARGET.RADIUS * size);
      const res = game.pointer(d, performance.now());
      if (res) {
        done.current = true;
        onDone(res.score);
      }
    };
    canvas.addEventListener('pointerdown', onPointer);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointer);
    };
  }, [site, onDone]);
  return (
    <div className={styles.prompt}>
      <div className={styles.head}>
        <b>Lineup de smoke · site {site}</b>
      </div>
      <div className={styles.hint}>toque no ponto quando ele aparecer</div>
      <canvas ref={canvasRef} className={styles.lineup} />
    </div>
  );
}
