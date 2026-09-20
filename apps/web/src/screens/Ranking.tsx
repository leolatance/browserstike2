import { useEffect, useState } from 'react';
import { RANKS, rankOf } from '@idle-strike/engine';
import { fetchLadder, fetchMyMmr, type LadderRow } from '../store/online';
import { getCharacter } from '../store/character';
import { cloudEnabled } from '../store/supabase';
import { useQuery } from '../store/useQuery';
import { RankIcon } from '../ui/RankIcon';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';
import styles from './Ranking.module.css';

type Tab = 'rating' | 'mmr';

/** Ladders (materialized views refreshed every 5 min by pg_cron). */
export function Ranking() {
  const [tab, setTab] = useState<Tab>('rating');
  const [global, setGlobal] = useState(false);
  const [tier, setTier] = useState<number | 'all'>('all');
  const [rows, setRows] = useState<LadderRow[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const { data: c } = useQuery(getCharacter);
  const { data: mine } = useQuery(fetchMyMmr);

  useEffect(() => {
    if (!cloudEnabled) return;
    fetchMyMmr().then(async (m) => {
      const s = m?.seasonId ?? null;
      setSeason(s);
      if (s) setRows(await fetchLadder(tab, s, global));
    });
  }, [tab, global]);

  const filtered = rows.filter((r) => tier === 'all' || rankOf(r.mmr).tier === tier);
  const myRow = c ? rows.find((r) => r.nick.toLowerCase() === c.nick.toLowerCase()) : undefined;

  return (
    <Shell title="Ranking">
      <div className={ui.page}>
        {!cloudEnabled && (
          <section className={ui.card}>
            <span className={ui.muted}>Ranking precisa do Supabase configurado.</span>
          </section>
        )}
        <section className={ui.card}>
          <div className={ui.row}>
            <button aria-pressed={tab === 'rating'} onClick={() => setTab('rating')}>
              Rating
            </button>
            <button aria-pressed={tab === 'mmr'} onClick={() => setTab('mmr')}>
              Patente
            </button>
            {tab === 'rating' && (
              <button aria-pressed={global} onClick={() => setGlobal((v) => !v)}>
                {global ? 'global (normalizado)' : 'por faixa'}
              </button>
            )}
            <span className={ui.muted}>temporada {season ?? '…'} · atualiza a cada 5 min</span>
          </div>
          <div className={ui.row}>
            <button aria-pressed={tier === 'all'} onClick={() => setTier('all')}>
              todas as faixas
            </button>
            {RANKS.map((r) => (
              <button key={r.tier} aria-pressed={tier === r.tier} onClick={() => setTier(r.tier)} title={r.name}>
                {r.tier}
              </button>
            ))}
          </div>
        </section>
        <section className={ui.card}>
          {filtered.length === 0 && <span className={ui.muted}>Ninguém aqui ainda (mínimo 3 partidas online para o rating; a view atualiza a cada 5 min).</span>}
          {filtered.map((r) => (
            <div key={r.nick} className={styles.row}>
              <span className={`${styles.pos} mono`}>{tab === 'rating' && global ? r.pos_global : r.pos}</span>
              <RankIcon mmr={r.mmr} size={22} />
              <a className={styles.nick} href={`/u/${encodeURIComponent(r.nick)}`}>
                {r.nick}
              </a>
              <span className={`mono ${styles.val}`}>{tab === 'rating' ? (global ? r.rating_global?.toFixed(2) : r.rating?.toFixed(2)) : r.mmr}</span>
              <span className={`mono ${styles.n}`}>{r.matches}</span>
            </div>
          ))}
        </section>
        <div className={styles.footer}>
          {c && mine && (
            <>
              <RankIcon mmr={mine.mmr} size={22} withName />
              <span>
                {myRow ? `você: #${tab === 'rating' && global ? myRow.pos_global : myRow.pos}` : mine.matches < 3 ? `${mine.matches}/3 partidas online pra entrar` : 'você: fora do corte'}
              </span>
              <span className="mono">{mine.mmr} MMR</span>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
