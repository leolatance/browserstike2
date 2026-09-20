import { useEffect, useState } from 'react';
import type { Reveal } from '../store/cards';
import { CardView } from './CardView';
import styles from './BoxOpen.module.css';

interface Props {
  reveals: Reveal[];
  title?: string;
  onDone: () => void;
}

/** Opens a box one card at a time: tap to flip the next card. */
export function BoxOpen({ reveals, title = 'Box de cartas', onDone }: Props) {
  const [shown, setShown] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const current = reveals[shown - 1];
  const next = () => {
    if (flipping) return;
    if (shown >= reveals.length) {
      onDone();
      return;
    }
    setFlipping(true);
    setShown((n) => n + 1);
  };
  useEffect(() => {
    if (!flipping) return;
    const id = setTimeout(() => setFlipping(false), 450);
    return () => clearTimeout(id);
  }, [flipping]);

  return (
    <div className={styles.box} onClick={next} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && next()}>
      <div className={styles.title}>
        {title} · {Math.min(shown, reveals.length)}/{reveals.length}
      </div>
      <div className={styles.stage}>
        {current ? (
          <div className={`${styles.flip} ${flipping ? styles.flipping : ''}`} key={shown}>
            <CardView card={current.card} level={current.to} badge={current.from === null ? 'novo' : current.overflow ? 'extra' : `${roman(current.from)} → ${roman(current.to)}`} />
          </div>
        ) : (
          <div className={styles.back}>toque para abrir</div>
        )}
      </div>
      {current && current.from !== null && !current.overflow && (
        <div className={styles.levelup}>
          {current.card.name} {roman(current.from)} → {roman(current.to)}
        </div>
      )}
      {current && current.overflow && <div className={styles.muted}>já está no nível III · cópia guardada</div>}
      <div className={styles.hint}>{shown >= reveals.length ? 'toque para continuar' : 'toque para a próxima'}</div>
      <div className={styles.dots}>
        {reveals.map((r, i) => (
          <i key={i} className={i < shown ? styles.dotOn : styles.dotOff} data-rarity={r.card.rarity} />
        ))}
      </div>
    </div>
  );
}

function roman(l: number): string {
  return ['', 'I', 'II', 'III'][l] ?? String(l);
}
