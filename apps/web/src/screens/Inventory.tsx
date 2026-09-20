import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CARDS, CLASS_LABEL, RARITY_NAME, card, type Card, type CardRarity, type PlayerClass } from '@idle-strike/engine';
import { listCards, openBox, unopenedBoxes, type Reveal } from '../store/cards';
import { useQuery } from '../store/useQuery';
import { BoxOpen } from '../ui/BoxOpen';
import { CardView } from '../ui/CardView';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';
import styles from './Inventory.module.css';

type TypeFilter = 'all' | Card['type'];
type ClassFilter = 'all' | PlayerClass;

export function Inventory() {
  const { data: owned } = useQuery(listCards);
  const { data: boxes } = useQuery(unopenedBoxes);
  const [type, setType] = useState<TypeFilter>('all');
  const [cls, setCls] = useState<ClassFilter>('all');
  const [reveals, setReveals] = useState<Reveal[] | null>(null);

  const rows = useMemo(() => {
    const map = new Map((owned ?? []).map((r) => [r.id, r]));
    return CARDS.map((c) => ({ card: c, row: map.get(c.id) ?? null }))
      .filter((x) => type === 'all' || x.card.type === type)
      .filter((x) => cls === 'all' || x.card.tag === cls);
  }, [owned, type, cls]);

  const byRarity = [5, 4, 3, 2, 1] as CardRarity[];
  const ownedCount = owned?.length ?? 0;

  const open = async () => {
    const box = boxes?.[0];
    if (!box?.id) return;
    setReveals(await openBox(box.id));
  };

  return (
    <Shell title="Inventário">
      <div className={ui.page}>
        <section className={ui.card}>
          <div className={ui.row}>
            <span>
              <b className="mono">{ownedCount}</b>/{CARDS.length} cartas
            </span>
            <span className={ui.muted}>
              boxes não abertas: <b className="mono">{boxes?.length ?? 0}</b>
            </span>
            <button className="primary" disabled={!boxes?.length || reveals !== null} onClick={() => void open()}>
              Abrir box
            </button>
            <Link to="/build">Build →</Link>
          </div>
        </section>

        {reveals && <BoxOpen reveals={reveals} onDone={() => setReveals(null)} />}

        <section className={ui.card}>
          <div className={ui.row}>
            {(['all', 'flat', 'conditional', 'behavior'] as TypeFilter[]).map((t) => (
              <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>
                {t === 'all' ? 'todas' : t === 'flat' ? 'planas' : t === 'conditional' ? 'condicionais' : 'comportamentais'}
              </button>
            ))}
          </div>
          <div className={ui.row}>
            <button aria-pressed={cls === 'all'} onClick={() => setCls('all')}>
              qualquer classe
            </button>
            {(Object.keys(CLASS_LABEL) as PlayerClass[]).map((k) => (
              <button key={k} aria-pressed={cls === k} onClick={() => setCls(k)}>
                {CLASS_LABEL[k]}
              </button>
            ))}
          </div>
        </section>

        {byRarity.map((r) => {
          const group = rows.filter((x) => x.card.rarity === r);
          if (!group.length) return null;
          return (
            <section key={r} className={ui.card}>
              <span className={ui.h2} data-rarity={r}>
                {RARITY_NAME[r]} · {group.filter((x) => x.row).length}/{group.length}
              </span>
              <div className={styles.grid}>
                {group.map(({ card: c, row }) => (
                  <CardView key={c.id} card={card(c.id)} level={row?.level ?? 1} dimmed={!row} badge={row && row.qty > 1 ? `×${row.qty}` : undefined} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
