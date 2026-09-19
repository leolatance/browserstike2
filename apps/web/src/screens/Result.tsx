import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { displayRating } from '@idle-strike/engine';
import { attrCap, matchXp, xpForLevel, type MatchXpBreakdown } from '../progression/xp';
import { getCharacter, grantXp } from '../store/character';
import { saveMatch } from '../store/matches';
import { getOutcome, setOutcome, setPendingMatch } from '../store/pending';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';
import styles from './Result.module.css';

interface Persisted {
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
          return { xp, levelFrom: c.level, levelTo: c.level, xpNow: c.xp, reached: [] };
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
        return { xp, levelFrom, levelTo: next.level, xpNow: next.xp, reached: next.reached };
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

  return (
    <Shell title="Resultado">
      <div className={ui.page}>
        <section className={`${ui.card} ${won ? styles.win : styles.loss}`}>
          <span className={ui.h2}>{won ? 'Vitória' : 'Derrota'}</span>
          <div className={`${styles.score} mono`}>
            {log.score[source.myTeam]} – {log.score[other]}
            <span className={styles.opp}> vs {log.teams[other].name}</span>
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
              <div className={ui.muted}>Box de cartas: em breve.</div>
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
