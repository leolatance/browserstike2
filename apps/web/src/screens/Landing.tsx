import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MAP01, Rng, generateBotMatchup, isEvent, simulateMatch, type KillEvent } from '@idle-strike/engine';
import { colorScheme } from '../match/colors';
import { KillFeed, type FeedEntry } from '../match/KillFeed';
import { Radar } from '../match/Radar';
import { ReplayPlayer } from '../match/replay';
import { fetchLadder, fetchMyMmr, type LadderRow } from '../store/online';
import { cloudEnabled } from '../store/supabase';
import { RankIcon } from '../ui/RankIcon';
import styles from './Landing.module.css';

/** Seed picked for a 1v3 clutch in round 1 and a 6–6 first half (see scripts/seedpick). */
export const TRAILER_SEED = 4;
export const TAGLINE = 'CS pra quando você não pode abrir o CS.';
export const SUBLINE = 'Seu boneco. Partidas 5x5 simuladas, treino, cartas, patente e ranking. No navegador, no celular, no Mac.';

/** Landing for visitors without a character: the match itself is the trailer. */
export function Landing() {
  const log = useMemo(() => simulateMatch({ map: MAP01, teams: generateBotMatchup(new Rng(TRAILER_SEED), 50, 50) }, TRAILER_SEED), []);
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const player = useMemo(() => new ReplayPlayer(log, { hold: 6 }), [log]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    player.attach();
    let last = 0;
    const unsub = player.subscribe((s) => {
      // Loop forever; the feed re-renders a few times per second at most.
      if (s.finished) player.restart();
      const now = performance.now();
      if (now - last > 250) {
        last = now;
        setTick((t) => t + 1);
      }
    });
    if (reduced) {
      // One still frame in the middle of the clutch round instead of motion.
      (player as unknown as { set: (p: object) => void }).set({ roundIdx: 0, t: 70, playing: false });
    } else player.play();
    return () => {
      unsub();
      player.detach();
    };
  }, [player, reduced]);

  const ri = player.rounds[player.getState().roundIdx] ?? player.rounds[0]!;
  const scheme = useMemo(() => colorScheme(log, 'hltv', 'a1', 0, 'yellow', ri.start.sides), [log, ri]);
  const nick = useMemo(() => new Map(log.teams.flatMap((t) => t.players.map((p) => [p.id, p.nick] as const))), [log]);
  const t = player.getState().t;
  const feed: FeedEntry[] = ri.events
    .filter((e): e is KillEvent => isEvent(e, 'kill') && e.t <= t)
    .slice(-4)
    .reverse()
    .map((kill) => ({
      kill,
      attackerNick: nick.get(kill.attacker) ?? kill.attacker,
      victimNick: nick.get(kill.victim) ?? kill.victim,
      attackerSide: scheme.of(kill.attacker) === 'var(--ct)' ? 'CT' : 'T',
      victimSide: scheme.of(kill.victim) === 'var(--ct)' ? 'CT' : 'T',
    }));
  void tick;

  const [top, setTop] = useState<LadderRow[]>([]);
  useEffect(() => {
    if (!cloudEnabled) return;
    fetchMyMmr()
      .then((m) => (m ? fetchLadder('rating', m.seasonId) : []))
      .then((rows) => setTop(rows.slice(0, 5)))
      .catch(() => setTop([]));
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.radar}>
          <Radar player={player} map={MAP01} highlight="" scheme={scheme} />
        </div>
        <div className={styles.feed}>
          <KillFeed entries={feed} />
        </div>
        <div className={styles.shade} />
      </div>

      <main className={styles.hero}>
        <div className={styles.brand}>IDLE STRIKE 2</div>
        <h1 className={styles.tagline}>{TAGLINE}</h1>
        <p className={styles.sub}>{SUBLINE}</p>
        <Link to="/onboarding" className={styles.cta}>
          Criar boneco
        </Link>
        <Link to="/login" className={styles.secondary}>
          já tenho conta
        </Link>
        <div className={styles.chips}>
          <span>sem download</span>
          <span>·</span>
          <span>funciona offline</span>
          <span>·</span>
          <span>grátis</span>
        </div>
      </main>

      {top.length > 0 && (
        <footer className={styles.top}>
          <div className={styles.topTitle}>Top 5 rating desta temporada</div>
          <ol className={styles.topList}>
            {top.map((r) => (
              <li key={r.nick}>
                <RankIcon mmr={r.mmr} size={16} />
                <a href={`/u/${encodeURIComponent(r.nick)}`}>{r.nick}</a>
                <b className="mono">{r.rating?.toFixed(2)}</b>
              </li>
            ))}
          </ol>
        </footer>
      )}
    </div>
  );
}
