import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BOT_TEAM_NAMES, MAP01, Rng, averageAttr, generateBotTeam, makePlayer, type PlayerClass, type Team } from '@idle-strike/engine';
import { getCharacter } from '../store/character';
import { career, formMultiplier } from '../store/matches';
import { setPendingMatch } from '../store/pending';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';
import styles from './Queue.module.css';

/** GDD 4.3: teammates cover the other roles; the character is a Rifler without an active set. */
const TEAMMATE_CLASSES: PlayerClass[] = ['igl', 'awper', 'entry', 'anchor'];
const PREVIEW_MS = 2000;

const CLASS_LABEL: Record<PlayerClass, string> = {
  entry: 'Entry',
  igl: 'IGL',
  awper: 'AWPer',
  anchor: 'Âncora',
  rifler: 'Rifler',
  support: 'Support',
  star: 'Star',
};

export function Queue() {
  const nav = useNavigate();
  const [preview, setPreview] = useState<{ teams: [Team, Team]; level: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    (async () => {
      const c = await getCharacter();
      if (!c) return;
      const cs = await career();
      const seed = Math.floor(Math.random() * 2 ** 31);
      const rng = new Rng(seed);
      const avg = averageAttr(c.attrs);
      const names = rng.shuffle(BOT_TEAM_NAMES);
      const me = makePlayer('a1', c.nick, c.class, c.attrs, formMultiplier(cs.form));
      const mates = generateBotTeam({ rng, targetAvg: avg, idPrefix: 'x', classes: TEAMMATE_CLASSES, name: names[0] });
      const teamA: Team = {
        id: 'a',
        name: names[0] as string,
        players: [me, ...mates.players.map((p, i) => ({ ...p, id: `a${i + 2}`, nick: p.nick === c.nick ? `${p.nick}_` : p.nick }))],
      };
      const teamB = generateBotTeam({ rng, targetAvg: avg, idPrefix: 'b', name: names[1] });
      const startingCT = rng.pick([0, 1] as (0 | 1)[]);
      setPendingMatch({ kind: 'queue', seed, config: { mapId: MAP01.id, teams: [teamA, teamB], startingCT }, myId: 'a1', myTeam: 0 });
      if (cancelled) return;
      setPreview({ teams: [teamA, teamB], level: c.level });
      timer = window.setTimeout(() => {
        if (!cancelled) nav('/match', { replace: true });
      }, PREVIEW_MS);
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nav]);

  return (
    <Shell title="Queue solo">
      <div className={ui.page}>
        {!preview ? (
          <section className={ui.card}>
            <span className={ui.h2}>Procurando partida…</span>
            <span className={ui.muted}>9 bots nivelados pelo seu atributo médio (± 8).</span>
          </section>
        ) : (
          <>
            <section className={ui.card}>
              <span className={ui.h2}>Partida encontrada</span>
              <div className={styles.map}>
                mapa <b>{MAP01.name}</b> · MR12
              </div>
            </section>
            <div className={styles.teams}>
              {preview.teams.map((team, ti) => (
                <section key={team.id} className={ui.card}>
                  <span className={`${ui.h2} ${ti === 0 ? 'ct' : 't'}`}>{team.name}</span>
                  {team.players.map((p) => (
                    <div key={p.id} className={`${styles.row} ${p.id === 'a1' ? styles.me : ''}`}>
                      <span className={styles.nick}>{p.nick}</span>
                      <span className={styles.cls}>{CLASS_LABEL[p.class]}</span>
                      <span className={`${styles.lvl} mono`}>{p.id === 'a1' ? `lvl ${preview.level}` : `~${averageAttr(p.attrs).toFixed(0)}`}</span>
                    </div>
                  ))}
                </section>
              ))}
            </div>
            <div className={ui.muted}>entrando…</div>
          </>
        )}
      </div>
    </Shell>
  );
}
