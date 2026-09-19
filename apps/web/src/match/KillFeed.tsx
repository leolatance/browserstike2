import type { KillEvent, Side } from '@idle-strike/engine';
import { WeaponIcon } from './WeaponIcon';
import styles from './KillFeed.module.css';

export interface FeedEntry {
  kill: KillEvent;
  attackerNick: string;
  victimNick: string;
  attackerSide: Side;
  victimSide: Side;
  /** Nick of the assisting teammate, if any. */
  assist?: string;
  /** Nick of the flash assister, if any. */
  flashAssist?: string;
}

export function KillFeed({ entries }: { entries: FeedEntry[] }) {
  return (
    <div className={styles.feed} aria-live="polite">
      {entries.length === 0 && <div className={styles.empty}>Sem kills ainda neste round</div>}
      {entries.map(({ kill, attackerNick, victimNick, attackerSide, victimSide, assist, flashAssist }) => (
        <div key={`${kill.round}-${kill.t}-${kill.victim}`} className={styles.row}>
          <span className={attackerSide === 'CT' ? styles.ct : styles.t}>
            {attackerNick}
            {assist && <span className={styles.assist}> +{assist}</span>}
            {flashAssist && <span className={styles.assist}> +{flashAssist}⚡</span>}
          </span>
          <span className={styles.weapon}>
            <WeaponIcon id={kill.weapon} />
            {kill.headshot && <span className={styles.tag}>HS</span>}
            {kill.trade && <span className={styles.tag}>trade</span>}
          </span>
          <span className={victimSide === 'CT' ? styles.ct : styles.t}>{victimNick}</span>
        </div>
      ))}
    </div>
  );
}
