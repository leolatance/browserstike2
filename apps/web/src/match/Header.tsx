import type { BuyType, Side } from '@idle-strike/engine';
import { BUY_LABEL, clock, money } from './format';
import styles from './Header.module.css';

export interface HeaderProps {
  teamNames: [string, string];
  score: [number, number];
  /** Team index playing CT this round. */
  ctTeam: 0 | 1;
  /** Label such as "round 7" or "OT 2". Never derived from the future. */
  roundLabel: string;
  /** Seconds left on the round clock (or on the bomb when planted). */
  secondsLeft: number;
  planted: boolean;
  econ: Record<Side, { avg: number; buy: BuyType }>;
  /** Shown during the round-end hold. */
  result: string | null;
}

export function Header(p: HeaderProps) {
  const ctIdx = p.ctTeam;
  const tIdx: 0 | 1 = ctIdx === 0 ? 1 : 0;
  return (
    <header className={styles.header}>
      <div className={`${styles.team} ${styles.ct}`}>
        <span className={styles.name}>{p.teamNames[ctIdx]}</span>
        <span className={styles.side}>CT</span>
      </div>
      <div className={styles.center}>
        <div className={`${styles.score} mono`}>
          <span className={styles.ctScore}>{p.score[ctIdx]}</span>
          <span className={styles.dash}>–</span>
          <span className={styles.tScore}>{p.score[tIdx]}</span>
        </div>
        <div className={`${styles.clock} mono ${p.planted ? styles.bomb : ''}`}>
          {p.planted && (
            <svg width="14" height="10" viewBox="0 0 14 10" aria-label="C4 plantada">
              <rect x="0" y="0" width="14" height="10" rx="1.5" fill="currentColor" />
            </svg>
          )}
          {clock(p.secondsLeft)}
        </div>
        <div className={styles.round}>
          {p.result ? p.result : p.roundLabel}
        </div>
      </div>
      <div className={`${styles.team} ${styles.t}`}>
        <span className={styles.name}>{p.teamNames[tIdx]}</span>
        <span className={styles.side}>T</span>
      </div>
      <div className={styles.econ}>
        <span className={`${styles.ct}`}>
          $ {money(p.econ.CT.avg)} <em>{BUY_LABEL[p.econ.CT.buy] ?? p.econ.CT.buy}</em>
        </span>
        <span className={`${styles.t}`}>
          $ {money(p.econ.T.avg)} <em>{BUY_LABEL[p.econ.T.buy] ?? p.econ.T.buy}</em>
        </span>
      </div>
    </header>
  );
}
