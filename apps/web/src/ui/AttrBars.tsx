import { ATTR_KEYS, type Attrs } from '@idle-strike/engine';
import styles from './AttrBars.module.css';

export const ATTR_LABEL: Record<keyof Attrs, string> = {
  mira: 'Mira',
  mov: 'Movimentação',
  peek: 'Peek',
  tatico: 'Tático',
  util: 'Utilitária',
  mental: 'Mental',
};

/** Six 0–100 bars with the level cap marked. `deltas` highlights recent gains. */
export function AttrBars({ attrs, cap, deltas }: { attrs: Attrs; cap: number; deltas?: Partial<Attrs> }) {
  return (
    <div className={styles.list}>
      {ATTR_KEYS.map((k) => (
        <div key={k} className={styles.row}>
          <span className={styles.label}>{ATTR_LABEL[k]}</span>
          <div className={styles.track} aria-label={`${ATTR_LABEL[k]} ${attrs[k].toFixed(1)} de ${cap.toFixed(0)}`}>
            <div className={styles.fill} style={{ width: `${attrs[k]}%` }} />
            <div className={styles.cap} style={{ left: `${cap}%` }} />
          </div>
          <span className={`${styles.value} mono`}>
            {attrs[k].toFixed(1)}
            {deltas?.[k] ? <em className={styles.delta}>+{deltas[k]!.toFixed(2)}</em> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
