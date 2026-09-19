import type { BuyEvent, Side } from '@idle-strike/engine';
import { weapon } from '@idle-strike/engine';
import { WeaponIcon } from './WeaponIcon';
import styles from './Loadout.module.css';

export interface LoadoutRow {
  buy: BuyEvent;
  nick: string;
  side: Side;
}

const UTIL_SHORT: Record<string, string> = { flash: 'F', smoke: 'S', molotov: 'M', he: 'HE' };

/** Freezetime panel: what every player is carrying this round. */
export function Loadout({ rows, secondsLeft }: { rows: LoadoutRow[]; secondsLeft: number }) {
  const side = (s: Side) => rows.filter((r) => r.side === s);
  return (
    <div className={styles.overlay} role="region" aria-label="Loadout do round">
      <div className={styles.title}>
        freezetime <span className="mono">{Math.max(0, Math.ceil(secondsLeft))}s</span>
      </div>
      <div className={styles.cols}>
        {(['CT', 'T'] as Side[]).map((s) => (
          <table key={s} className={styles.table}>
            <thead>
              <tr>
                <th className={s === 'CT' ? styles.ct : styles.t}>{s}</th>
                <th>arma</th>
                <th>eq.</th>
                <th>util</th>
              </tr>
            </thead>
            <tbody>
              {side(s).map(({ buy, nick }) => (
                <tr key={buy.player}>
                  <td className={styles.nick}>{nick}</td>
                  <td className={styles.weapon}>
                    <WeaponIcon id={buy.weapon} size={22} />
                    <span>{weapon(buy.weapon).name}</span>
                  </td>
                  <td className={styles.eq}>
                    {buy.armor ? (buy.helmet ? 'kev+cap' : 'kev') : '–'}
                    {buy.kit ? ' · kit' : ''}
                  </td>
                  <td className={styles.utils}>
                    {buy.utils.length === 0 ? '–' : buy.utils.map((u, i) => <span key={i} className={styles.u} data-u={u}>{UTIL_SHORT[u] ?? u}</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
