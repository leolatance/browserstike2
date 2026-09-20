import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLASS_LABEL, Rng, card, displayRating, hasCard, resolveBuild } from '@idle-strike/engine';
import { createBox, openBox, rollMatchBox, type Reveal } from '../store/cards';
import { BoxOpen } from '../ui/BoxOpen';
import { attrCap, matchXp, xpForLevel, type MatchXpBreakdown } from '../progression/xp';
import { getCharacter, grantXp } from '../store/character';
import { saveMatch } from '../store/matches';
import { getOutcome, setOutcome, setPendingMatch } from '../store/pending';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';
import styles from './Result.module.css';

interface Persisted {
  boxId: number | null;
  xp: MatchXpBreakdown;
  levelFrom: number;
  levelTo: number;
  xpNow: number;
  reached: number[];
}

// Module-level lock so StrictMode's double effect never saves twice.
let saving: Promise<Persisted> | null = null;

export function Result() {
  const nav = useNavigate();
  const outcome = getOutcome();
  const [p, setP] = useState<Persisted | null>(null);
  const [reveals, setReveals] = useState<Reveal[] | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!outcome) {
      nav('/lobby', { replace: true });
      return;
    }
    if (started.current) return;
    started.current = true;
    if (!saving) {
      saving = (async () => {
        const c = await getCharacter();
        if (!c) throw new Error('No character');
        const { log, source, minigame } = outcome;
        const stats = log.stats.find((s) => s.id === source.myId)!;
        const won = log.winner === source.myTeam;
        const xp = matchXp({ won, rating: stats.rating, minigameAvg: minigame ? minigame.average : null, mode: 'solo' });
        if (outcome.savedId !== undefined) {
          return { boxId: null, xp, levelFrom: c.level, levelTo: c.level, xpNow: c.xp, reached: [] };
        }
        const levelFrom = c.level;
        const next = await grantXp(xp.xp);
        const id = await saveMatch({
          playedAt: Date.now(),
          seed: source.seed,
          config: source.config,
          score: log.score,
          winner: log.winner,
          myTeam: source.myTeam,
          myId: source.myId,
          stats,
          rating: stats.rating,
          rewards: { xp: xp.xp, minigame, levelFrom, levelTo: next.level },
        });
        setOutcome({ ...outcome, savedId: id });
        setPendingMatch(null);
        // GDD 8.1: one box per solo match, rolled from the match seed.
        const boxId = await createBox('match', rollMatchBox(new Rng((source.seed ^ 0x9e3779b9) >>> 0)));
        return { boxId, xp, levelFrom, levelTo: next.level, xpNow: next.xp, reached: next.reached };
      })();
      saving.finally(() => {
        saving = null;
      });
    }
    saving.then(setP);
  }, [outcome, nav]);

  if (!outcome) return null;
  const { log, source, minigame } = outcome;
  const stats = log.stats.find((s) => s.id === source.myId)!;
  const won = log.winner === source.myTeam;
  const other = source.myTeam === 0 ? 1 : 0;
  const teamRank = log.stats.filter((s) => s.team === source.myTeam).sort((a, b) => b.rating - a.rating).findIndex((s) => s.id === source.myId) + 1;
  const isMvp = log.stats.slice().sort((a, b) => b.rating - a.rating)[0]?.id === source.myId;
  const played = resolveBuild(source.config.teams[source.myTeam].players.find((pl) => pl.id === source.myId)?.build ?? { cards: [] });
  const triggers = Object.entries(stats.cardTriggers ?? {}).sort((a, b) => b[1] - a[1]);
  const triggerLabel = (id: string) => (hasCard(id) ? card(id).name : id.startsWith('set:') ? `conjunto ${CLASS_LABEL[id.slice(4) as keyof typeof CLASS_LABEL] ?? id}` : id);
  const context = isMvp ? 'MVP da partida' : teamRank === 1 ? 'top do seu time' : teamRank <= 3 ? `${teamRank}º do seu time` : `carregado: ${teamRank}º do time`;

  return (
    <Shell title="Resultado">
      <div className={ui.page}>
        <section className={`${ui.card} ${won ? styles.win : styles.loss}`}>
          <span className={ui.h2}>{won ? 'Vitória' : 'Derrota'}</span>
          <div className={`${styles.score} mono`}>
            {log.score[source.myTeam]} – {log.score[other]}
            <span className={styles.opp}> vs {log.teams[other].name}</span>
          </div>
          <div className={isMvp || teamRank === 1 ? styles.contextGood : ui.muted}>{context}</div>
          <div className={ui.muted}>
            jogou de <b>{CLASS_LABEL[played.activeClass]}</b>
            {played.sets.length > 1 ? ` (híbrido ${played.sets.map((s) => CLASS_LABEL[s]).join(' + ')})` : ''}
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
            <b>{stats.assists}</b>
            <span>assists</span>
          </div>
          <div className={ui.stat}>
            <b>{stats.adr.toFixed(0)}</b>
            <span>ADR</span>
          </div>
          <div className={ui.stat}>
            <b>{stats.kast.toFixed(0)}%</b>
            <span>KAST</span>
          </div>
          <div className={ui.stat}>
            <b>{stats.kills ? Math.round((100 * stats.headshots) / stats.kills) : 0}%</b>
            <span>HS</span>
          </div>
          <div className={`${ui.stat} ${styles.ratingStat}`}>
            <b>{displayRating(stats.rating).toFixed(2)}</b>
            <span>rating</span>
          </div>
        </section>

        {triggers.length > 0 && (
          <section className={ui.card}>
            <span className={ui.h2}>Cartas que dispararam</span>
            {triggers.map(([id, n]) => (
              <div key={id} className={ui.row}>
                <span>{triggerLabel(id)}</span>
                <b className="mono">{n}×</b>
              </div>
            ))}
          </section>
        )}

        {minigame && (
          <section className={ui.card}>
            <span className={ui.h2}>Minigame · alvo de duelo</span>
            <div className={ui.row}>
              <span>
                média <b className="mono">{minigame.accompanied ? minigame.average : '–'}</b>
              </span>
              <span>
                acompanhados <b className="mono">{minigame.accompanied}/{minigame.total}</b>
              </span>
              {minigame.perfect && minigame.total > 0 && <span className={styles.badge}>PERFECT</span>}
            </div>
          </section>
        )}

        <section className={ui.card}>
          <span className={ui.h2}>Recompensa</span>
          {p ? (
            <>
              <div className={`${styles.xp} mono`}>+{p.xp.xp} XP</div>
              <div className={ui.muted}>
                {p.xp.base} × resultado {p.xp.result.toFixed(1)} × desempenho {p.xp.performance.toFixed(2)} × minigame {p.xp.minigame.toFixed(2)} × modo solo
              </div>
              {p.reached.length > 0 ? (
                <div className={styles.levelUp}>
                  <div className={styles.levelBadge}>LEVEL UP</div>
                  <div>
                    lvl {p.levelFrom} → <b>lvl {p.levelTo}</b> · cap de atributo {attrCap(p.levelFrom).toFixed(1)} → <b>{attrCap(p.levelTo).toFixed(1)}</b>
                  </div>
                </div>
              ) : (
                <div className={ui.muted}>
                  lvl {p.levelTo} · {p.xpNow}/{xpForLevel(p.levelTo)} xp
                </div>
              )}
              {p.boxId !== null && !reveals && (
                <button className="primary" onClick={() => void openBox(p.boxId as number).then(setReveals)}>
                  Abrir box de cartas
                </button>
              )}
              {reveals && <BoxOpen reveals={reveals} onDone={() => setReveals(null)} />}
            </>
          ) : (
            <div className={ui.muted}>salvando…</div>
          )}
        </section>

        <button className={`primary ${ui.big}`} onClick={() => nav('/lobby')}>
          Voltar ao lobby
        </button>
      </div>
    </Shell>
  );
}
