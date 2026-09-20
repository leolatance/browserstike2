import { useEffect, useRef, useState } from 'react';
import { DUEL_TARGET, DuelTargetGame, type DuelTargetStats } from './duelTarget';
import styles from './DuelTargetPanel.module.css';

interface Props {
  /** Session length in seconds. */
  durationSec: number;
  spawnMs: [number, number];
  visibleMs: number;
  /** Short beep on hit (off by default in settings). */
  sound: boolean;
  onFinish: (stats: DuelTargetStats) => void;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  at: number;
  hit: boolean;
}

/** Continuous target drill (treino / DM): targets on a timer, no simulation. */
export function TargetDrill({ durationSec, spawnMs, visibleMs, sound, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<DuelTargetStats | null>(null);
  const [left, setLeft] = useState(durationSec);
  const finished = useRef(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;

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
    const floaters: Floater[] = [];
    let audio: AudioContext | null = null;

    const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const accent = css('--accent');
    const ok = css('--ok');
    const danger = css('--danger');

    const beep = (score: number) => {
      if (!soundRef.current) return;
      try {
        audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.frequency.value = 440 + score * 4;
        g.gain.value = 0.05;
        o.connect(g).connect(audio.destination);
        o.start();
        o.stop(audio.currentTime + 0.07);
      } catch {
        /* no audio: ignore */
      }
    };

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

    const drawRange = () => {
      // Shooting-range look: dark lanes + faint grid.
      const lanes = 5;
      for (let i = 0; i < lanes; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0)';
        ctx.fillRect((i * w) / lanes, 0, w / lanes, h);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      const step = Math.max(24, Math.min(w, h) / 10);
      for (let x = step; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = step; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // Floor line
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.82);
      ctx.lineTo(w, h * 0.82);
      ctx.stroke();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      drawRange();
      const now = performance.now();
      const target = game.target;
      if (target) {
        const life = Math.min(1, (now - target.spawnedAt) / visibleMs);
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
      }
      // Hit markers + floating numbers
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i] as Floater;
        const age = (now - f.at) / 700;
        if (age >= 1) {
          floaters.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = 1 - age;
        ctx.strokeStyle = f.hit ? ok : danger;
        ctx.lineWidth = 2;
        const m = 6;
        ctx.beginPath();
        ctx.moveTo(f.x - m, f.y - m);
        ctx.lineTo(f.x + m, f.y + m);
        ctx.moveTo(f.x + m, f.y - m);
        ctx.lineTo(f.x - m, f.y + m);
        ctx.stroke();
        ctx.fillStyle = f.hit ? ok : danger;
        ctx.font = `800 ${Math.max(14, Math.min(w, h) * 0.06)}px ${css('--mono')}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(f.text, f.x, f.y - 10 - age * 30);
        ctx.globalAlpha = 1;
      }
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
      const rect = canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      if (!target) {
        floaters.push({ x: px, y: py, text: 'x', at: performance.now(), hit: false });
        return;
      }
      const r = DUEL_TARGET.RADIUS * Math.min(w, h);
      const d = Math.hypot(px - target.x * w, py - target.y * h) / r;
      const res = game.pointer(d, performance.now());
      if (res) {
        floaters.push({ x: px, y: py, text: res.score > 0 ? `+${res.score}` : 'x', at: performance.now(), hit: res.score > 0 });
        if (res.score > 0) beep(res.score);
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
      audio?.close().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streak = stats?.streak ?? 0;
  return (
    <section className={styles.panel} aria-label="Treino de alvo">
      <div ref={wrapRef} className={`${styles.arena} ${styles.tall}`}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={`${styles.timer} mono`}>{left}s</div>
        {streak >= 2 && <div className={`${styles.streak} mono`}>{streak}×</div>}
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
      </div>
    </section>
  );
}
