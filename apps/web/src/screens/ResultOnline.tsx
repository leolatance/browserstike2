import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLASS_LABEL, card, displayRating, rankOf, resolveBuild } from '@idle-strike/engine';
import { logHash } from '../store/online';
import { getOutcome, setPendingMatch } from '../store/pending';
import { pullNow } from '../store/sync';
import { saveMatch } from '../store/matches';
import { CardView } from '../ui/CardView';
import { RankIcon } from '../ui/RankIcon';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';
import styles from './Result.module.css';

/** Online result: everything here was decided by the server; we only display and then pull the cloud state. */
export function ResultOnline() {
  const nav = useNavigate();
  const outcome = getOutcome();
  const [pulled, setPulled] = useState(false);
  const once = useRef(false);
  useEffect(() => {
    if (!outcome || outcome.source.kind !== 'online') {
      nav('/lobby', { replace: true });
      return;
    }
    if (once.current) return;
    once.current = true;
    setPendingMatch(null);
    const src = outcome.source;
    const st = outcome.log.stats.find((s) => s.id === src.myId);
    const rw = src.online?.rewards;
    const save = st && rw
      ? saveMatch({
          playedAt: Date.now(),
          seed: src.seed,
          config: src.config,
          score: outcome.log.score,
          winner: outcome.log.winner,
          myTeam: src.myTeam,
          myId: src.myId,
          stats: st,
          rating: st.rating,
          rewards: { xp: rw.xp, minigame: outcome.minigame, levelFrom: rw.level - rw.reached.length, levelTo: rw.level },
          mode: 'online',
        })
      : Promise.resolve();
    void save.then(() => pullNow()).finally(() => setPulled(true));
  }, [outcome, nav]);
  if (!outcome || outcome.source.kind !== 'online' || !outcome.source.online) return null;
  const { log, source } = outcome;
  const info = source.online as NonNullable<typeof source.online>;
  const stats = log.stats.find((s) => s.id === source.myId)!;
  const won = log.winner === source.myTeam;
  const other = source.myTeam === 0 ? 1 : 0;
  const hashOk = logHash(log) === info.hash;
  const played = resolveBuild(source.config.teams[source.myTeam].players.find((p) => p.id === source.myId)?.build ?? { cards: [] });
  const r = info.rewards;

  return (
    <Shell title="Resultado online">
      <div className={ui.page}>
        <section className={`${ui.card} ${won ? styles.win : styles.loss}`}>
          <span className={ui.h2}>{won ? 'Vitória' : 'Derrota'} · online</span>
          <div className={`${styles.score} mono`}>
            {log.score[source.myTeam]} – {log.score[other]}
            <span className={styles.opp}> vs {log.teams[other].name}</span>
          </div>
          <div className={ui.muted}>
            jogou de <b>{CLASS_LABEL[played.activeClass]}</b> · {info.realPlayers - 1} bonecos reais no lobby · replay {hashOk ? 'confere com o servidor ✓' : 'DIVERGIU do servidor (hash)'}
          </div>
        </section>
        <section className={ui.grid3}>
          <div className={ui.stat}>
            <b>
              {stats.kills}-{stats.deaths}
            </b>
            <span>K-D</span>
          </div>
          <div className={ui.stat}>
            <b>{stats.adr.toFixed(0)}</b>
            <span>ADR</span>
          </div>
          <div className={`${ui.stat} ${styles.ratingStat}`}>
            <b>{displayRating(stats.rating).toFixed(2)}</b>
            <span>rating</span>
          </div>
        </section>
        <section className={ui.card}>
          <span className={ui.h2}>Patente</span>
          <div className={ui.row}>
            <RankIcon mmr={r.mmrBefore} withName />
            <span className={ui.muted}>→</span>
            <RankIcon mmr={r.mmrAfter} withName />
            <b className={`mono ${r.mmrDelta >= 0 ? 'ct' : ''}`} style={r.mmrDelta < 0 ? { color: 'var(--danger)' } : undefined}>
              {r.mmrDelta >= 0 ? '+' : ''}
              {r.mmrDelta} MMR
            </b>
            <span className={ui.muted}>({r.mmrAfter})</span>
          </div>
          {rankOf(r.mmrBefore).tier !== rankOf(r.mmrAfter).tier && <div className={styles.contextGood}>{r.mmrAfter > r.mmrBefore ? 'Subiu de patente!' : 'Caiu de patente.'}</div>}
        </section>
        <section className={ui.card}>
          <span className={ui.h2}>Recompensa (servidor)</span>
          <div className={`${styles.xp} mono`}>+{r.xp} XP</div>
          <div className={ui.muted}>online ×1,6 · nível {r.level}{r.reached.length ? ' · LEVEL UP' : ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {r.cards.map((c, i) => (
              <CardView key={i} card={card(c.card)} level={(c.to as 1 | 2 | 3) ?? 1} small badge={c.from === null ? 'novo' : c.from === c.to ? 'pó' : `${c.from} → ${c.to}`} />
            ))}
          </div>
          <span className={ui.muted}>{pulled ? 'boneco atualizado da nuvem' : 'sincronizando…'}</span>
        </section>
        <div className={ui.grid2}>
          <button onClick={() => nav('/ranking')}>Ranking</button>
          <button className="primary" onClick={() => nav('/lobby')}>
            Voltar ao lobby
          </button>
        </div>
      </div>
    </Shell>
  );
}
