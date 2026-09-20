import { useEffect, useRef, useState } from 'react';
import { isEvent, type DuelEvent, type MatchEvent } from '@idle-strike/engine';
import type { ReplayPlayer } from '../match/replay';
import { DUEL_TARGET, DuelTargetGame, VARIANT_LABEL, type DuelTargetStats, type Variant } from './duelTarget';
import styles from './DuelTargetPanel.module.css';

interface Props {
  player: ReplayPlayer;
  /** The user's character id. */
  me: string;
  /** Ids of the user's teammates (incl. `me`), to read clutch/trade context. */
  team: string[];
  game: DuelTargetGame;
  /** Replay speed; at 4x the minigame switches itself off. */
  speed: number;
  onStats: (s: DuelTargetStats) => void;
}

/** Minigame variant from the duel situation: initiating → timing; holding an angle → pré-mira; flashed → flashado. */
export function variantFor(e: DuelEvent, me: string): Variant {
  const iAmA = e.attacker === me;
  if (iAmA ? e.situation.attackerFlashed : e.situation.defenderFlashed) return 'flash';
  if (iAmA) return 'timing';
  if (e.situation.holdingAngle) return 'premira';
  return 'alvo';
}

/** Human label for the duel context of `me`. Never changes the score. */
export function situationLabel(e: DuelEvent, me: string, team: string[], events: MatchEvent[]): string | null {
  const iAmA = e.attacker === me;
  const mySide = iAmA ? 'A' : 'D';
  const s = e.situation;
  if (s.clutch === mySide) {
    const enemiesDead = new Set<string>();
    for (const k of events) {
      if (k.t > e.t) break;
      if (isEvent(k, 'kill') && !team.includes(k.victim)) enemiesDead.add(k.victim);
    }
    return `clutch 1v${Math.max(1, 5 - enemiesDead.size)}`;
  }
  if (iAmA ? s.attackerFlashed : s.defenderFlashed) return 'flashado';
  if (iAmA) {
    const traded = events.some((k) => isEvent(k, 'kill') && k.t <= e.t && e.t - k.t <= 3 && team.includes(k.victim) && k.victim !== me);
    if (traded) return 'trade';
  }
  if (!iAmA && s.holdingAngle) return 'segurando ângulo';
  if (s.inSmoke) return 'em smoke';
  return null;
}

const EMPTY: DuelTargetStats = { last: null, average: 0, averageAll: 0, accompanied: 0, total: 0, streak: 0, perfect: false };

export function DuelTargetPanel({ player, me, team, game, speed, onStats }: Props) {
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
      const since = now - target.spawnedAt;
      const r = DUEL_TARGET.RADIUS * Math.min(w, h);
      const x = target.x * w;
      const y = target.y * h;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      const ok = getComputedStyle(document.documentElement).getPropertyValue('--ok').trim();
      const text = getComputedStyle(document.documentElement).getPropertyValue('--text-0').trim();
      const font = getComputedStyle(document.documentElement).getPropertyValue('--font');
      if (target.variant === 'timing') {
        // Sweeping bar with a green zone: tap when the cursor is inside.
        const bx = w * 0.08, bw = w * 0.84, by = h * 0.5, bh = Math.max(14, h * 0.12);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(bx, by - bh / 2, bw, bh);
        const zx = bx + (target.zoneAtMs / DUEL_TARGET.SWEEP_MS) * bw;
        const zw = (DUEL_TARGET.ZONE_MS / DUEL_TARGET.SWEEP_MS) * bw;
        ctx.fillStyle = ok;
        ctx.fillRect(zx - zw / 2, by - bh / 2, zw, bh);
        const cx = bx + Math.min(1, since / DUEL_TARGET.SWEEP_MS) * bw;
        ctx.fillStyle = accent;
        ctx.fillRect(cx - 2, by - bh, 4, bh * 2);
        if (target.label) {
          ctx.fillStyle = text;
          ctx.font = `600 ${Math.max(10, Math.min(w, h) * 0.07)}px ${font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(target.label, w / 2, by + bh + 6);
        }
        return;
      }
      if (target.variant === 'premira') {
        // Corner silhouette with a head-height mark; the enemy pops out after appearAtMs.
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + r * 0.6, 0, w - x, h);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + r * 0.6, 0, 3, h);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.lineTo(x + r, y);
        ctx.stroke();
        if (since >= target.appearAtMs) {
          ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--enemy').trim();
          ctx.beginPath();
          ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(x - r * 0.35, y + r * 0.4, r * 0.7, r * 1.2);
        }
        if (target.label) {
          ctx.fillStyle = text;
          ctx.font = `600 ${Math.max(10, Math.min(w, h) * 0.07)}px ${font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(target.label, x, y + r * 1.9);
        }
        return;
      }
      const life = Math.min(1, since / game.visibleMs);
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
      if (target.label) {
        ctx.fillStyle = text;
        ctx.font = `600 ${Math.max(10, Math.min(w, h) * 0.07)}px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(target.label, x, y + r * 1.7);
      }
      if (target.variant === 'flash') {
        // Flashed: white overlay fading over FLASH_MS.
        const a = Math.max(0, 1 - since / DUEL_TARGET.FLASH_MS);
        if (a > 0) {
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(0, 0, w, h);
        }
      }
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
            const v = variantFor(e, me);
            game.spawn(e.id, performance.now(), VARIANT_LABEL[v], undefined, v);
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
  }, [player, me, team, game, onStats]);

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
          {stats.last?.label && <i className={styles.label}> {stats.last.label}</i>}
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
