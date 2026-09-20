import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { MAP01, isEvent, type KillEvent, type MatchLog } from '@idle-strike/engine';
import { KillFeed, type FeedEntry } from '../match/KillFeed';
import { Radar } from '../match/Radar';
import { colorScheme } from '../match/colors';
import { useReplay } from '../match/useReplay';
import { DuelTargetGame, type DuelTargetStats } from '../minigames/duelTarget';
import { DuelTargetPanel } from '../minigames/DuelTargetPanel';
import type { PlayerColor } from '../store/db';
import { aimMap } from './aimMap';
import styles from './X1View.module.css';

interface Props {
  log: MatchLog;
  /** 'a1' (host / character) or 'b1' (guest). */
  me: string;
  myColor: PlayerColor;
  rounds: number;
  game: DuelTargetGame;
  onStats: (s: DuelTargetStats) => void;
  onFinish: () => void;
  /** Extra header line (live opponent minigame score online). */
  extra?: ReactNode;
  /** Bot mode lets the user skip to the end; online never does. */
  allowSkip?: boolean;
  /** Called when the score changes (kills up to the replay clock). */
  onScore?: (score: [number, number]) => void;
}

/** x1 match screen: aim-map radar, first-to-N score, minigame on every duel, kill feed. */
export function X1View({ log, me, myColor, rounds, game, onStats, onFinish, extra, allowSkip = false, onScore }: Props) {
  const { player, state } = useReplay(log, { rate: 1, hold: 2 });
  const map = useMemo(() => aimMap(MAP01), []);
  const ri = player.rounds[0]!;
  const scheme = useMemo(() => colorScheme(log, 'player', me, me === 'a1' ? 0 : 1, myColor, ri.start.sides), [log, me, myColor, ri.start.sides]);
  const t = state.t;
  const finished = useRef(false);
  useEffect(() => {
    if (state.finished && !finished.current) {
      finished.current = true;
      onFinish();
    }
  }, [state.finished, onFinish]);

  const a = log.teams[0].players[0]!;
  const b = log.teams[1].players[0]!;
  const kills = ri.events.filter((e): e is KillEvent => isEvent(e, 'kill') && e.t <= t);
  const aKills = kills.filter((k) => k.attacker === a.id).length;
  const bKills = kills.filter((k) => k.attacker === b.id).length;
  const myScore = me === a.id ? aKills : bKills;
  const oppScore = me === a.id ? bKills : aKills;
  const lastScore = useRef('');
  useEffect(() => {
    const key = `${myScore}-${oppScore}`;
    if (key !== lastScore.current) {
      lastScore.current = key;
      onScore?.([myScore, oppScore]);
    }
  }, [myScore, oppScore, onScore]);

  const duels = ri.events.filter((e) => isEvent(e, 'duel') && e.t <= t).length;
  const mine = me === a.id ? a : b;
  const opp = me === a.id ? b : a;
  const side = (id: string) => (id === a.id ? 'CT' : 'T') as 'CT' | 'T';
  const feed: FeedEntry[] = kills
    .slice(-6)
    .reverse()
    .map((kill) => ({ kill, attackerNick: kill.attacker === a.id ? a.nick : b.nick, victimNick: kill.victim === a.id ? a.nick : b.nick, attackerSide: side(kill.attacker), victimSide: side(kill.victim), attackerColor: scheme.of(kill.attacker), victimColor: scheme.of(kill.victim) }));

  return (
    <div className={styles.view}>
      <header className={styles.head}>
        <span className={styles.nick} style={{ color: scheme.of(mine.id) }}>
          {mine.nick}
        </span>
        <span className={`${styles.score} mono`}>
          {myScore} – {oppScore}
        </span>
        <span className={`${styles.nick} ${styles.right}`} style={{ color: scheme.of(opp.id) }}>
          {opp.nick}
        </span>
        <div className={styles.sub}>
          <span>primeiro a {rounds}</span>
          <span>duelo {duels}</span>
        </div>
        {extra && <div className={styles.extra}>{extra}</div>}
      </header>
      <div className={styles.radarWrap}>
        <Radar player={player} map={map} highlight={me} scheme={scheme} />
        {!state.playing && !state.finished && <div className={styles.paused}>pausado</div>}
      </div>
      <div className={styles.controls}>
        <button onClick={() => player.toggle()} disabled={state.finished}>
          {state.playing ? '❚❚' : '▶'}
        </button>
        {allowSkip && (
          <button onClick={() => player.skipToEnd()} disabled={state.finished}>
            pular
          </button>
        )}
      </div>
      <DuelTargetPanel player={player} me={me} team={[me]} game={game} speed={1} onStats={onStats} />
      <section>
        <h2 className={styles.h2}>Kill feed</h2>
        <KillFeed entries={feed} />
      </section>
    </div>
  );
}
