/**
 * Replay player: walks a MatchLog through time. Pure TS (no React) so it can be
 * unit-tested and reused by future minigames. Time inside a round is measured
 * in game seconds; 1x plays GAME_SECONDS_PER_REAL_SECOND game seconds per
 * wall-clock second (GDD 9: a round ≈ 15–20s).
 */
import type { MatchEvent, MatchLog, RoundEndEvent, RoundStartEvent, RoundSummary } from '@idle-strike/engine';

export const GAME_SECONDS_PER_REAL_SECOND = 5;
/** Game seconds kept on screen after roundEnd before the next round starts. */
export const ROUND_END_HOLD = 12;
/** Cap per-frame delta so a stalled tab never jumps ahead when it resumes. */
const MAX_FRAME_DT = 0.1;

export type Speed = 1 | 2 | 4;
export const SPEEDS: Speed[] = [1, 2, 4];

export interface RoundIndex {
  round: number;
  events: MatchEvent[];
  start: RoundStartEvent;
  end: RoundEndEvent;
  summary: RoundSummary;
}

export interface ReplayState {
  roundIdx: number;
  /** Game seconds since the round started (may exceed end.t during the hold). */
  t: number;
  playing: boolean;
  speed: Speed;
  finished: boolean;
}

export function indexRounds(log: MatchLog): RoundIndex[] {
  const byRound = new Map<number, MatchEvent[]>();
  for (const e of log.events) {
    let list = byRound.get(e.round);
    if (!list) byRound.set(e.round, (list = []));
    list.push(e);
  }
  return log.rounds.map((summary) => {
    const events = byRound.get(summary.round) ?? [];
    const start = events.find((e): e is RoundStartEvent => e.type === 'roundStart');
    const end = events.find((e): e is RoundEndEvent => e.type === 'roundEnd');
    if (!start || !end) throw new Error(`Round ${summary.round} is missing start/end events`);
    return { round: summary.round, events, start, end, summary };
  });
}

type Listener = (state: ReplayState) => void;

export class ReplayPlayer {
  readonly rounds: RoundIndex[];
  private state: ReplayState = { roundIdx: 0, t: 0, playing: false, speed: 1, finished: false };
  private listeners = new Set<Listener>();
  private rafId: number | null = null;
  private lastTs: number | null = null;
  private pausedByVisibility = false;
  private attached = false;

  constructor(readonly log: MatchLog) {
    this.rounds = indexRounds(log);
  }

  get current(): RoundIndex {
    return this.rounds[this.state.roundIdx] as RoundIndex;
  }

  getState(): ReplayState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  detach(): void {
    this.pause();
    if (!this.attached) return;
    this.attached = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  play(): void {
    if (this.state.playing || this.state.finished) return;
    this.set({ playing: true });
    this.lastTs = null;
    this.rafId = requestAnimationFrame(this.loop);
  }

  pause(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.lastTs = null;
    if (this.state.playing) this.set({ playing: false });
  }

  toggle(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }

  setSpeed(speed: Speed): void {
    this.set({ speed });
  }

  nextRound(): void {
    if (this.state.roundIdx >= this.rounds.length - 1) {
      this.skipToEnd();
      return;
    }
    this.set({ roundIdx: this.state.roundIdx + 1, t: 0 });
  }

  skipToEnd(): void {
    this.pause();
    const last = this.rounds.length - 1;
    this.set({ roundIdx: last, t: (this.rounds[last] as RoundIndex).end.t + ROUND_END_HOLD, finished: true, playing: false });
  }

  restart(): void {
    this.pause();
    this.set({ roundIdx: 0, t: 0, finished: false });
    this.play();
  }

  private set(patch: Partial<ReplayState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  private loop = (ts: number): void => {
    if (!this.state.playing) return;
    const dt = this.lastTs === null ? 0 : Math.min(MAX_FRAME_DT, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    let { roundIdx, t } = this.state;
    t += dt * GAME_SECONDS_PER_REAL_SECOND * this.state.speed;
    const round = this.rounds[roundIdx] as RoundIndex;
    if (t >= round.end.t + ROUND_END_HOLD) {
      if (roundIdx >= this.rounds.length - 1) {
        this.rafId = null;
        this.set({ t: round.end.t + ROUND_END_HOLD, playing: false, finished: true });
        return;
      }
      roundIdx += 1;
      t = 0;
    }
    this.set({ roundIdx, t });
    this.rafId = requestAnimationFrame(this.loop);
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      if (this.state.playing) {
        this.pausedByVisibility = true;
        this.pause();
      }
    } else if (this.pausedByVisibility) {
      this.pausedByVisibility = false;
      this.play();
    }
  };
}
