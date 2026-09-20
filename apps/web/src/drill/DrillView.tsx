import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { MAP01, isEvent, type KillEvent, type MatchLog } from '@idle-strike/engine';
import { KillFeed, type FeedEntry } from '../match/KillFeed';
import { Radar } from '../match/Radar';
import { clock } from '../match/format';
import { useReplay } from '../match/useReplay';
import { DuelTargetGame, type DuelTargetStats } from '../minigames/duelTarget';
import { DuelTargetPanel } from '../minigames/DuelTargetPanel';
import styles from './DrillView.module.css';

export interface FocusBar {
  label: string;
  value: number;
  cap: number;
  gained: number;
}

interface Props {
  log: MatchLog;
  me: string;
  title: string;
  subtitle?: string;
  /** Game seconds per real second. Drills run at 1. */
  rate?: number;
  minigame: boolean;
  game?: DuelTargetGame;
  onMiniStats?: (s: DuelTargetStats) => void;
  /** Called whenever the character's kill count crosses a new value. */
  onMyKills?: (kills: number) => void;
  onFinish: () => void;
  focus?: FocusBar | null;
  /** Rendered over the radar (call prompt, lineup). */
  overlay?: ReactNode;
  /** Scoreboard replacement: kills per player. */
  showKills?: boolean;
}

/** Match screen for drills: radar, feed, kills board, optional minigame, focus bar. */
export function DrillView({ log, me, title, subtitle, rate = 1, minigame, game, onMiniStats, onMyKills, onFinish, focus, overlay, showKills = true }: Props) {
  const { player, state } = useReplay(log, { rate, hold: 2 });
  const ri = player.rounds[0]!;
  const t = state.t;
  const finished = useRef(false);
  useEffect(() => {
    if (state.finished && !finished.current) {
      finished.current = true;
      onFinish();
    }
  }, [state.finished, onFinish]);

  const nickOf = useMemo(() => new Map(log.teams.flatMap((tm) => tm.players.map((p) => [p.id, p.nick] as const))), [log]);
  const teamOf = useMemo(() => new Map(log.teams.flatMap((tm, i) => tm.players.map((p) => [p.id, i as 0 | 1] as const))), [log]);
  const sideOf = (id: string) => (teamOf.get(id) === 0 ? 'CT' : 'T') as 'CT' | 'T';
  const kills = ri.events.filter((e): e is KillEvent => isEvent(e, 'kill') && e.t <= t);
  const myKills = kills.filter((k) => k.attacker === me).length;
  const lastReported = useRef(-1);
  useEffect(() => {
    if (myKills !== lastReported.current) {
      lastReported.current = myKills;
      onMyKills?.(myKills);
    }
  }, [myKills, onMyKills]);

  const feed: FeedEntry[] = kills
    .slice(-6)
    .reverse()
    .map((kill) => ({ kill, attackerNick: nickOf.get(kill.attacker) ?? kill.attacker, victimNick: nickOf.get(kill.victim) ?? kill.victim, attackerSide: sideOf(kill.attacker), victimSide: sideOf(kill.victim) }));
  const board = log.teams
    .flatMap((tm) => tm.players)
    .map((p) => ({ id: p.id, nick: p.nick, side: sideOf(p.id), k: kills.filter((x) => x.attacker === p.id).length, d: kills.filter((x) => x.victim === p.id).length }))
    .sort((a, b) => b.k - a.k || a.d - b.d);
  const total = ri.end.t;
  const left = Math.max(0, total - Math.min(t, total));

  return (
    <div className={styles.view}>
      <header className={styles.head}>
        <div className={styles.title}>
          <b>{title}</b>
          {subtitle && <span className={styles.sub}>{subtitle}</span>}
        </div>
        <div className={`${styles.timer} mono`}>{clock(left)}</div>
        {focus && (
          <div className={styles.focus}>
            <span>
              {focus.label} <b className="mono">{focus.value.toFixed(2)}</b>
              {focus.gained > 0 && <em className={styles.gain}>+{focus.gained.toFixed(2)}</em>}
            </span>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${Math.min(100, focus.value)}%` }} />
              <div className={styles.cap} style={{ left: `${focus.cap}%` }} />
            </div>
          </div>
        )}
      </header>
      <div className={styles.radarWrap}>
        <Radar player={player} map={MAP01} highlight={me} />
        {overlay && <div className={styles.overlay}>{overlay}</div>}
        {!state.playing && !state.finished && !overlay && <div className={styles.paused}>pausado</div>}
      </div>
      <div className={styles.controls}>
        <button onClick={() => player.toggle()} disabled={state.finished}>
          {state.playing ? '❚❚' : '▶'}
        </button>
        <button onClick={() => player.skipToEnd()} disabled={state.finished}>
          pular
        </button>
      </div>
      {minigame && game && <DuelTargetPanel player={player} me={me} team={log.teams[0].players.map((p) => p.id)} game={game} speed={1} onStats={onMiniStats ?? (() => undefined)} />}
      <div className={styles.cols}>
        <section>
          <h2 className={styles.h2}>Kill feed</h2>
          <KillFeed entries={feed} />
        </section>
        {showKills && (
          <section>
            <h2 className={styles.h2}>Kills</h2>
            <table className={styles.board}>
              <tbody>
                {board.map((r) => (
                  <tr key={r.id} className={r.id === me ? styles.me : ''}>
                    <td className={r.side === 'CT' ? 'ct' : 't'}>{r.nick}</td>
                    <td className="mono">{r.k}</td>
                    <td className={`mono ${styles.d}`}>{r.d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
