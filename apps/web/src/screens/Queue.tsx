import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BOT_TEAM_NAMES, MAP01, Rng, averageAttr, generateBotTeam, makePlayer, type PlayerClass, type Team } from '@idle-strike/engine';
import { getCharacter } from '../store/character';
import { career, formMultiplier } from '../store/matches';
import { setPendingMatch } from '../store/pending';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';

/** GDD 4.3: teammates cover the other roles; the character is a Rifler without an active set. */
const TEAMMATE_CLASSES: PlayerClass[] = ['igl', 'awper', 'entry', 'anchor'];

export function Queue() {
  const nav = useNavigate();
  useEffect(() => {
    let cancelled = false;
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
      // A short beat so the queue feels like a queue.
      await new Promise((r) => setTimeout(r, 700));
      if (!cancelled) nav('/match', { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [nav]);
  return (
    <Shell title="Queue solo">
      <div className={ui.page}>
        <section className={ui.card}>
          <span className={ui.h2}>Procurando partida…</span>
          <span className={ui.muted}>9 bots nivelados pelo seu atributo médio (± 8).</span>
        </section>
      </div>
    </Shell>
  );
}
