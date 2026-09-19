import type { MatchLog } from '@idle-strike/engine';
import { displayRating } from '@idle-strike/engine';
import type { DuelTargetStats } from '../minigames/duelTarget';
import styles from './EndScreen.module.css';

interface Props {
  log: MatchLog;
  minigame: DuelTargetStats | null;
  onReplay: () => void;
  onNewMatch: () => void;
}

export function EndScreen({ log, minigame, onReplay, onNewMatch }: Props) {
  const nick = (id: string) => log.teams.flatMap((t) => t.players).find((p) => p.id === id)?.nick ?? id;
  const top = log.stats.slice().sort((a, b) => b.rating - a.rating).slice(0, 3);
  const mvp = log.stats.filter((s) => s.team === log.winner).sort((a, b) => b.rating - a.rating)[0];
  return (
    <div className={styles.overlay} role="dialog" aria-label="Fim de partida">
      <div className={styles.card}>
        <div className={styles.label}>Fim de partida{log.overtime ? ' · overtime' : ''}</div>
        <div className={`${styles.score} mono`}>
          <span className={log.winner === 0 ? styles.win : ''}>{log.teams[0].name}</span>
          <strong>
            {log.score[0]} – {log.score[1]}
          </strong>
          <span className={log.winner === 1 ? styles.win : ''}>{log.teams[1].name}</span>
        </div>
        {mvp && (
          <div className={styles.mvp}>
            <span className={styles.mvpTag}>MVP</span> {nick(mvp.id)} <span className="mono">{displayRating(mvp.rating).toFixed(2)}</span>
          </div>
        )}
        <table className={styles.top}>
          <tbody>
            {top.map((s, i) => (
              <tr key={s.id}>
                <td className={styles.rank}>{i + 1}</td>
                <td className={styles.nick}>
                  {nick(s.id)} <span className={styles.team}>{log.teams[s.team].name}</span>
                </td>
                <td className="mono">
                  {s.kills}-{s.deaths}
                </td>
                <td className={`mono ${styles.rating}`}>{displayRating(s.rating).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {minigame && (
          <div className={styles.mini}>
            <div className={styles.label}>Minigame · alvo de duelo</div>
            <div className={styles.miniRow}>
              <span>
                média <b className="mono">{minigame.accompanied ? minigame.average : '–'}</b>
              </span>
              <span>
                acompanhados <b className="mono">{minigame.accompanied}/{minigame.total}</b>
              </span>
              {minigame.perfect && minigame.total > 0 && <span className={styles.badge}>PERFECT</span>}
            </div>
            <div className={styles.hint}>sem recompensa ainda</div>
          </div>
        )}
        <div className={styles.actions}>
          <button onClick={onReplay}>Rever</button>
          <button className="primary" onClick={onNewMatch}>
            Nova partida
          </button>
        </div>
      </div>
    </div>
  );
}
