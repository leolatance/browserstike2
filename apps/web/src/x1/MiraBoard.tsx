import { useEffect, useRef, useState } from 'react';
import { DUEL_TARGET, DuelTargetGame, VARIANT_LABEL } from '../minigames/duelTarget';
import { drawTarget, type Mark } from '../minigames/drawTarget';
import { MIRA, MiraMatch, roundDeadline, roundStart, roundTargetId, roundVariant, type Shot, type Side } from './mira';
import { serverNow } from './online';
import type { Transport } from './transport';
import styles from './MiraBoard.module.css';

interface Props {
  matchId: number;
  seed: number;
  /** Server-clock start (ms). */
  startAt: number;
  transport: Transport;
  uid: string;
  myNick: string;
  oppNick: string;
  onFinish: (score: [number, number], winner: Side | null, rounds: number) => void;
}

/**
 * x1 de mira: both boards show the same target per round; mine is live, theirs
 * mirrors it and marks where/when they tapped. Rounds are scheduled from the
 * server clock, so neither side waits for the other to start.
 */
export function MiraBoard({ matchId, seed, startAt, transport, uid, myNick, oppNick, onFinish }: Props) {
  const mineRef = useRef<HTMLCanvasElement>(null);
  const theirsRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [round, setRound] = useState(-1);
  const [results, setResults] = useState<(Side | null)[]>([]);
  const [myLast, setMyLast] = useState<number | null>(null);
  const [theirLast, setTheirLast] = useState<number | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const mineC = mineRef.current;
    const theirsC = theirsRef.current;
    if (!mineC || !theirsC) return;
    const mineCtx = mineC.getContext('2d');
    const theirsCtx = theirsC.getContext('2d');
    if (!mineCtx || !theirsCtx) return;
    const mine = new DuelTargetGame();
    const theirs = new DuelTargetGame();
    const arb = new MiraMatch();
    const roundOf = new Map<string, number>();
    const theirShots = new Map<number, Shot>();
    let spawned = 0;
    let finished = false;
    let w = 0;
    let h = 0;

    const size = (c: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      const parent = c.parentElement!;
      w = Math.max(120, Math.floor(parent.clientWidth));
      h = Math.max(120, Math.floor(parent.clientHeight));
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const resize = () => {
      size(mineC, mineCtx);
      size(theirsC, theirsCtx);
    };

    const markFor = (s: Shot): Mark => ({ x: s.x, y: s.y, score: s.score });

    const finish = () => {
      if (finished) return;
      finished = true;
      onFinishRef.current(arb.score(), arb.winner(), arb.played());
    };

    const step = () => {
      const now = serverNow();
      const pnow = performance.now();
      // Spawn the round whose start has passed (one at a time, no catching up on old rounds).
      const n = Math.floor((now - startAt - MIRA.FIRST_ROUND_DELAY_MS) / MIRA.ROUND_MS);
      if (!finished && n >= spawned && n >= 0 && n < MIRA.ROUNDS + MIRA.MAX_EXTRA) {
        if (now - roundStart(startAt, n) < MIRA.ROUND_MS - MIRA.DEADLINE_MARGIN_MS) {
          const id = roundTargetId(matchId, n);
          const v = roundVariant(seed, n);
          roundOf.set(id, n);
          mine.spawn(id, pnow, VARIANT_LABEL[v], undefined, v);
          theirs.spawn(id, pnow, VARIANT_LABEL[v], undefined, v);
          setRound(n);
          if (import.meta.env.DEV && n === 0) console.info('[x1] round 1 spawned', { matchId, at: Date.now(), serverAt: now });
        }
        spawned = n + 1;
      }
      mine.tick(pnow);
      theirs.tick(pnow);
      // Resolve rounds whose deadline passed.
      for (let r = arb.played(); r < spawned; r++) {
        if (now < roundDeadline(startAt, r)) break;
        arb.resolve(r);
        setScore(arb.score());
        setResults([...arb.results]);
        if (arb.finished()) finish();
      }
      mineCtx.clearRect(0, 0, w, h);
      if (mine.target) drawTarget(mineCtx, w, h, mine.target, pnow, mine.visibleMs);
      theirsCtx.clearRect(0, 0, w, h);
      if (theirs.target) {
        const r = roundOf.get(theirs.target.id);
        const s = r !== undefined ? theirShots.get(r) : undefined;
        drawTarget(theirsCtx, w, h, theirs.target, pnow, theirs.visibleMs, s ? [markFor(s)] : []);
      }
    };

    const onPointer = (ev: PointerEvent) => {
      ev.preventDefault();
      const t = mine.target;
      if (!t || finished) return;
      const r = roundOf.get(t.id);
      if (r === undefined) return;
      const now = serverNow();
      if (now >= roundDeadline(startAt, r)) return;
      const rect = mineC.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const rad = DUEL_TARGET.RADIUS * Math.min(w, h);
      const distance = Math.hypot(px - t.x * w, py - t.y * h) / rad;
      const sinceSpawn = performance.now() - t.spawnedAt;
      const res = mine.pointer(distance, performance.now());
      if (!res) return;
      // Where to draw the mark on the other side: for timing it's the sweep position at the tap.
      const mark = t.variant === 'timing' ? { x: 0.08 + 0.84 * Math.min(1, sinceSpawn / DUEL_TARGET.SWEEP_MS), y: 0.5 } : { x: px / w, y: py / h };
      const shot: Shot = { round: r, score: res.score, reactionMs: res.reactionMs ?? sinceSpawn, distance, x: mark.x, y: mark.y, ts: now };
      arb.record('me', shot);
      transport.send({ type: 'shot', from: uid, shot });
      setMyLast(res.score);
    };

    const off = transport.onMessage((m) => {
      if (m.type !== 'shot') return;
      const s = m.shot as Shot;
      arb.record('them', s);
      theirShots.set(s.round, s);
      setTheirLast(s.score);
    });

    let raf = 0;
    const loop = () => {
      step();
      raf = requestAnimationFrame(loop);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mineC.parentElement!);
    resize();
    raf = requestAnimationFrame(loop);
    mineC.addEventListener('pointerdown', onPointer);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
      mineC.removeEventListener('pointerdown', onPointer);
    };
  }, [matchId, seed, startAt, transport, uid]);

  const variant = round >= 0 ? roundVariant(seed, round) : null;
  return (
    <div className={styles.board}>
      <header className={styles.head}>
        <span className={styles.nick}>{myNick}</span>
        <span className={`${styles.score} mono`}>
          {score[0]} – {score[1]}
        </span>
        <span className={`${styles.nick} ${styles.right}`}>{oppNick}</span>
        <div className={styles.sub}>
          <span>{round < 0 ? 'começando…' : `rodada ${Math.min(round + 1, MIRA.ROUNDS + MIRA.MAX_EXTRA)}${round >= MIRA.ROUNDS ? ' · desempate' : ` / ${MIRA.ROUNDS}`}`}</span>
          <span>{variant ? VARIANT_LABEL[variant] : ''}</span>
        </div>
      </header>
      <div className={styles.cols}>
        <div className={styles.arena}>
          <canvas ref={mineRef} className={styles.canvas} />
          <span className={styles.tag}>você</span>
          {myLast !== null && <span className={styles.last}>{myLast}</span>}
        </div>
        <div className={`${styles.arena} ${styles.theirs}`}>
          <canvas ref={theirsRef} className={styles.canvas} />
          <span className={styles.tag}>{oppNick}</span>
          {theirLast !== null && <span className={styles.last}>{theirLast}</span>}
        </div>
      </div>
      <div className={styles.dots} aria-label="Rodadas">
        {Array.from({ length: Math.max(MIRA.ROUNDS, results.length) }, (_, i) => (
          <span key={i} className={`${styles.dot} ${results[i] === 'me' ? styles.me : results[i] === 'them' ? styles.them : ''}`} />
        ))}
      </div>
      <div className={styles.wait}>um toque por rodada · maior score leva · empate: quem tocou antes</div>
    </div>
  );
}
