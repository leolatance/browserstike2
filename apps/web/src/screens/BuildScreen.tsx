import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CLASS_LABEL, SET_BONUS_TEXT, SET_SIZE, card, resolveBuild, setProgress, slotsForLevel, type EquippedCard, type PlayerClass } from '@idle-strike/engine';
import { currentBuild, listCards, saveBuild } from '../store/cards';
import { getCharacter } from '../store/character';
import { useQuery } from '../store/useQuery';
import { CardView } from '../ui/CardView';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';
import styles from './BuildScreen.module.css';

export function BuildScreen() {
  const { data: c } = useQuery(getCharacter);
  const { data: owned } = useQuery(listCards);
  const { data: saved } = useQuery(currentBuild);
  const [build, setBuild] = useState<EquippedCard[] | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const nav = useNavigate();
  const [params] = useSearchParams();
  // First visit (right after the initial box): the screen is a step, not a destination.
  const first = params.get('first') === '1';

  useEffect(() => {
    if (saved && build === null) setBuild(saved);
  }, [saved, build]);

  const slots = slotsForLevel(c?.level ?? 0);
  const cards = build ?? [];
  const resolved = useMemo(() => resolveBuild({ cards }), [cards]);
  const progress = useMemo(() => setProgress({ cards }), [cards]);

  const commit = async (next: EquippedCard[]) => {
    setBuild(next);
    await saveBuild(next);
  };
  const equip = (slot: number, id: string) => {
    const level = owned?.find((r) => r.id === id)?.level ?? 1;
    const next = cards.filter((e, i) => i !== slot && e.id !== id);
    next.splice(Math.min(slot, next.length), 0, { id, level });
    setPicking(null);
    void commit(next.slice(0, slots));
  };
  const unequip = (slot: number) => void commit(cards.filter((_, i) => i !== slot));

  const equippedIds = new Set(cards.map((e) => e.id));
  const available = (owned ?? []).filter((r) => !equippedIds.has(r.id));

  return (
    <Shell title="Build">
      <div className={ui.page}>
        <section className={ui.card}>
          <div className={ui.row}>
            <span>
              classe ativa: <b className={styles.cls}>{CLASS_LABEL[resolved.activeClass]}</b>
              {resolved.sets.length > 1 && <span className={ui.muted}> · híbrido com {resolved.sets.slice(1).map((s) => CLASS_LABEL[s]).join(' + ')}</span>}
            </span>
            <span className={ui.muted}>
              {slots} slots (lvl {c?.level ?? 0}) · próximo slot no lvl {nextSlotLevel(c?.level ?? 0)}
            </span>
            <Link to="/inventario">Inventário →</Link>
          </div>
          <div className={styles.sets}>
            {(Object.keys(CLASS_LABEL) as PlayerClass[]).map((k) => {
                const n = progress[k] ?? 0;
                return (
                  <span key={k} className={`${styles.set} ${n >= SET_SIZE ? styles.setOn : ''}`} title={SET_BONUS_TEXT[k]}>
                    {CLASS_LABEL[k]} {n}/{SET_SIZE}
                  </span>
                );
              })}
          </div>
          {resolved.sets.map((s) => (
            <div key={s} className={styles.bonus}>
              <b>{CLASS_LABEL[s]}:</b> {SET_BONUS_TEXT[s]}
            </div>
          ))}
        </section>

        <section className={ui.card}>
          <span className={ui.h2}>Slots · toque num slot e escolha a carta</span>
          <div className={styles.slots}>
            {Array.from({ length: slots }, (_, i) => {
              const e = cards[i];
              return e ? (
                <div key={i} className={styles.slot}>
                  <CardView card={card(e.id)} level={e.level} small selected={picking === i} onClick={() => setPicking(picking === i ? null : i)} />
                  <button className={styles.remove} onClick={() => unequip(i)} aria-label="Remover">
                    remover
                  </button>
                </div>
              ) : (
                <button key={i} className={`${styles.empty} ${picking === i ? styles.emptyActive : ''}`} onClick={() => setPicking(picking === i ? null : i)}>
                  slot {i + 1}
                  <span>vazio</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={ui.card}>
          <span className={ui.h2}>{picking === null ? 'Suas cartas' : `Escolha para o slot ${picking + 1}`}</span>
          {available.length === 0 && <div className={ui.muted}>Nenhuma carta livre. Abra boxes no inventário.</div>}
          <div className={styles.grid}>
            {available.map((r) => (
              <CardView key={r.id} card={card(r.id)} level={r.level} small onClick={() => equip(picking ?? cards.length, r.id)} dimmed={picking === null && cards.length >= slots} />
            ))}
          </div>
        </section>

        <section className={ui.card}>
          {first && <span className={ui.muted}>Equipou o que quis? Dá pra voltar aqui pelo lobby a qualquer hora.</span>}
          <button className={`primary ${ui.big}`} onClick={() => nav('/lobby')}>
            {first ? 'Pronto · bora jogar →' : 'Voltar ao lobby'}
          </button>
        </section>
      </div>
    </Shell>
  );
}

function nextSlotLevel(level: number): number | string {
  for (const l of [5, 12, 20, 35]) if (level < l) return l;
  return '—';
}
