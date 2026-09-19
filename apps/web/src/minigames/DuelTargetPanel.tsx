import { useEffect, useRef, useState } from 'react';
import { isEvent } from '@idle-strike/engine';
import type { ReplayPlayer } from '../match/replay';
import { DUEL_TARGET, DuelTargetGame, type DuelTargetStats } from './duelTarget';
import styles from './DuelTargetPanel.module.css';

interface Props {
  player: ReplayPlayer;
  /** The user's character id. */
  me: string;
  game: DuelTargetGame;
  /** Replay speed; at 4x the minigame switches itself off. */
  speed: number;
  onStats: (s: DuelTargetStats) => void;
}

const EMPTY: DuelTargetStats = { last: null, average: 0, accompanied: 0, total: 0, streak: 0, perfect: false };

export function DuelTargetPanel({ player, me, game, speed, onStats }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<DuelTargetStats>(EMPTY);
  const [flash, setFlash] = useState<number | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      w = Math.max(160, Math.floor(wrap.clientWidth));
      h = Math.max(120, Math.floor(wrap.clientHeight));
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const publish = () => {
      const s = game.stats();
      setStats(s);
      onStats(s);
    };

    // Cursor over the event stream: duels are consumed as replay time passes.
    let cursorRound = player.getState().roundIdx;
    let cursorT = player.getState().t;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const target = game.target;
      if (!target) return;
      const now = performance.now();
      const life = Math.min(1, (now - target.spawnedAt) / DUEL_TARGET.VISIBLE_MS);
      const r = DUEL_TARGET.RADIUS * Math.min(w, h);
      const x = target.x * w;
      const y = target.y * h;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
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
      // Shrinking ring = time left.
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r * (1.6 - 0.6 * life), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const onTick = () => {
      const st = player.getState();
      if (st.roundIdx !== cursorRound || st.t < cursorT) {
        // Jump (next round / skip / restart): don't count what was skipped or rewound.
        cursorRound = st.roundIdx;
        cursorT = st.t;
      }
      const enabled = speedRef.current < 4 && st.playing;
      if (enabled && st.t > cursorT) {
        const ri = player.current;
        for (const e of ri.events) {
          if (e.t <= cursorT) continue;
          if (e.t > st.t) break;
          if (isEvent(e, 'duel') && (e.attacker === me || e.defender === me)) {
            game.spawn(e.id, performance.now());
            publish();
          }
        }
      }
      cursorT = Math.max(cursorT, st.t);
      if (game.tick(performance.now())) publish();
      draw();
    };

    const onPointer = (ev: PointerEvent) => {
      ev.preventDefault();
      const target = game.target;
      if (!target) return;
      const rect = canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const r = DUEL_TARGET.RADIUS * Math.min(w, h);
      const distance = Math.hypot(px - target.x * w, py - target.y * h) / r;
      const res = game.pointer(distance, performance.now());
      if (res) {
        setFlash(res.score);
        publish();
        draw();
      }
    };

    // Keep the target ticking even between replay frames (paused → no spawns, but expiry still runs).
    let raf = 0;
    const loop = () => {
      if (game.tick(performance.now())) publish();
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const unsubscribe = player.subscribe(onTick);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    canvas.addEventListener('pointerdown', onPointer);
    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointer);
    };
  }, [player, me, game, onStats]);

  useEffect(() => {
    if (flash === null) return;
    const id = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(id);
  }, [flash]);

  return (
    <section className={styles.panel} aria-label="Minigame: alvo de duelo">
      <div ref={wrapRef} className={styles.arena}>
        <canvas ref={canvasRef} className={styles.canvas} />
        {speed >= 4 && <div className={styles.notice}>minigame desligado em 4x</div>}
        {flash !== null && <div className={styles.flash}>{flash}</div>}
      </div>
      <div className={styles.hud}>
        <span>
          último <b className="mono">{stats.last ? (stats.last.hit ? stats.last.score : 'x') : '–'}</b>
        </span>
        <span>
          média <b className="mono">{stats.accompanied ? stats.average : '–'}</b>
        </span>
        <span>
          duelos <b className="mono">{stats.accompanied}/{stats.total}</b>
        </span>
        <span>
          streak <b className="mono">{stats.streak}</b>
        </span>
        {stats.perfect && stats.total >= 3 && <span className={styles.perfect}>perfect</span>}
      </div>
    </section>
  );
}
