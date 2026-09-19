import { useEffect, useRef, useState } from 'react';
import { DUEL_TARGET, DuelTargetGame, type DuelTargetStats } from './duelTarget';
import styles from './DuelTargetPanel.module.css';

interface Props {
  /** Session length in seconds. */
  durationSec: number;
  spawnMs: [number, number];
  visibleMs: number;
  onFinish: (stats: DuelTargetStats) => void;
}

/** Continuous target drill (treino / DM): targets on a timer, no simulation. */
export function TargetDrill({ durationSec, spawnMs, visibleMs, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<DuelTargetStats | null>(null);
  const [left, setLeft] = useState(durationSec);
  const [flash, setFlash] = useState<number | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    finished.current = false; // StrictMode re-runs the effect after a cleanup
    const game = new DuelTargetGame(visibleMs);
    const startedAt = performance.now();
    let w = 0;
    let h = 0;
    let n = 0;
    let spawnTimer = 0;
    let raf = 0;

    const resize = () => {
      w = Math.max(160, Math.floor(wrap.clientWidth));
      h = Math.max(120, Math.floor(wrap.clientHeight));
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const target = game.target;
      if (!target) return;
      const life = Math.min(1, (performance.now() - target.spawnedAt) / visibleMs);
      const r = DUEL_TARGET.RADIUS * Math.min(w, h);
      const x = target.x * w;
      const y = target.y * h;
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r * (1.6 - 0.6 * life), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    const schedule = () => {
      const delay = spawnMs[0] + Math.random() * (spawnMs[1] - spawnMs[0]);
      spawnTimer = window.setTimeout(() => {
        if (finished.current) return;
        game.spawn(`t${++n}-${Math.floor(Math.random() * 1e9)}`, performance.now());
        setStats(game.stats());
        schedule();
      }, delay);
    };
    const loop = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setLeft(Math.max(0, Math.ceil(durationSec - elapsed)));
      if (game.tick(performance.now())) setStats(game.stats());
      draw();
      if (elapsed >= durationSec && !finished.current) {
        finished.current = true;
        clearTimeout(spawnTimer);
        onFinish(game.stats());
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    const onPointer = (ev: PointerEvent) => {
      ev.preventDefault();
      const target = game.target;
      if (!target) return;
      const rect = canvas.getBoundingClientRect();
      const r = DUEL_TARGET.RADIUS * Math.min(w, h);
      const d = Math.hypot(ev.clientX - rect.left - target.x * w, ev.clientY - rect.top - target.y * h) / r;
      const res = game.pointer(d, performance.now());
      if (res) {
        setFlash(res.score);
        setStats(game.stats());
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    canvas.addEventListener('pointerdown', onPointer);
    schedule();
    raf = requestAnimationFrame(loop);
    return () => {
      finished.current = true;
      clearTimeout(spawnTimer);
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (flash === null) return;
    const id = setTimeout(() => setFlash(null), 500);
    return () => clearTimeout(id);
  }, [flash]);

  return (
    <section className={styles.panel} aria-label="Treino de alvo">
      <div ref={wrapRef} className={`${styles.arena} ${styles.tall}`}>
        <canvas ref={canvasRef} className={styles.canvas} />
        {flash !== null && <div className={styles.flash}>{flash}</div>}
        <div className={`${styles.timer} mono`}>{left}s</div>
      </div>
      <div className={styles.hud}>
        <span>
          último <b className="mono">{stats?.last ? (stats.last.hit ? stats.last.score : 'x') : '–'}</b>
        </span>
        <span>
          média <b className="mono">{stats ? stats.averageAll : '–'}</b>
        </span>
        <span>
          alvos <b className="mono">{stats ? `${stats.accompanied}/${stats.total}` : '0/0'}</b>
        </span>
        <span>
          streak <b className="mono">{stats?.streak ?? 0}</b>
        </span>
      </div>
    </section>
  );
}
