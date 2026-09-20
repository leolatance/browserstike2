import { CLASS_LABEL, RARITY_NAME, cardText, type Card, type CardLevel } from '@idle-strike/engine';
import styles from './CardView.module.css';

/** Placeholder icon per theme (real art later). */
const THEME_ICON: Record<Card['theme'], string> = {
  aim: '◎',
  move: '⇢',
  peek: '◔',
  tac: '▦',
  util: '✺',
  mental: '◈',
  econ: '$',
};

const TYPE_LABEL: Record<Card['type'], string> = { flat: 'plana', conditional: 'condicional', behavior: 'comportamental' };

interface Props {
  card: Card;
  level: CardLevel;
  /** Compact tile for grids. */
  small?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  /** Extra corner label, e.g. "×2" or "novo". */
  badge?: string;
}

export function CardView({ card, level, small, selected, dimmed, onClick, badge }: Props) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`${styles.card} ${small ? styles.small : ''} ${selected ? styles.selected : ''} ${dimmed ? styles.dimmed : ''}`}
      data-rarity={card.rarity}
      onClick={onClick}
      aria-label={`${card.name}, ${RARITY_NAME[card.rarity]}, nível ${level}`}
    >
      <div className={styles.head}>
        <span className={styles.icon}>{THEME_ICON[card.theme]}</span>
        <span className={styles.pips} aria-label={`nível ${level}`}>
          {[1, 2, 3].map((l) => (
            <i key={l} className={l <= level ? styles.pipOn : styles.pipOff} />
          ))}
        </span>
      </div>
      <div className={styles.name}>{card.name}</div>
      {!small && <div className={styles.text}>{cardText(card, level)}</div>}
      <div className={styles.foot}>
        <span>{RARITY_NAME[card.rarity]}</span>
        <span>{card.tag ? CLASS_LABEL[card.tag] : TYPE_LABEL[card.type]}</span>
      </div>
      {badge && <span className={styles.badge}>{badge}</span>}
    </Tag>
  );
}
