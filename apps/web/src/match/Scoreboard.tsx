import { useState } from 'react';
import type { LiveRow } from './stats';
import styles from './Scoreboard.module.css';

interface Props {
  rows: LiveRow[];
  teamNames: [string, string];
  highlight: string;
}

export function Scoreboard({ rows, teamNames, highlight }: Props) {
  const [expanded, setExpanded] = useState(false);
  const groups: (0 | 1)[] = rows.find((r) => r.side === 'CT')?.team === 1 ? [1, 0] : [0, 1];
  return (
    <section className={styles.board}>
      <button className={styles.toggle} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        Scoreboard <span className={styles.chev}>{expanded ? '▴' : '▾'}</span>
      </button>
      {groups.map((teamIdx) => {
        const team = rows.filter((r) => r.team === teamIdx).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.kills - a.kills);
        const side = team[0]?.side ?? 'CT';
        return (
          <table key={teamIdx} className={`${styles.table} ${expanded ? styles.expanded : ''}`}>
            <thead>
              <tr>
                <th className={`${styles.nick} ${side === 'CT' ? styles.ct : styles.t}`}>
                  {teamNames[teamIdx]} <span className={styles.sideTag}>{side}</span>
                </th>
                <th>K</th>
                <th>D</th>
                {expanded && <th>A</th>}
                {expanded && <th>ADR</th>}
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {team.map((r) => (
                <tr key={r.id} className={`${r.id === highlight ? styles.me : ''} ${r.alive ? '' : styles.dead}`}>
                  <td className={styles.nick}>
                    <span className={styles.dot} data-side={r.side} />
                    {r.nick}
                    {expanded && <span className={styles.cls}>{r.cls}</span>}
                  </td>
                  <td className="mono">{r.kills}</td>
                  <td className="mono">{r.deaths}</td>
                  {expanded && <td className="mono">{r.assists}</td>}
                  {expanded && <td className="mono">{r.adr.toFixed(0)}</td>}
                  <td className={`mono ${styles.rating}`}>{r.rating === null ? '–' : r.rating.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </section>
  );
}
