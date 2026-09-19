import { useCallback, useMemo } from 'react';
import { MAP01, Rng, ROUND, generateBotMatchup, isEvent, simulateMatch, type KillEvent, type Side } from '@idle-strike/engine';
import { Controls } from '../match/Controls';
import { EndScreen } from '../match/EndScreen';
import { Header } from '../match/Header';
import { KillFeed, type FeedEntry } from '../match/KillFeed';
import { Radar } from '../match/Radar';
import { Scoreboard } from '../match/Scoreboard';
import { REASON_LABEL } from '../match/format';
import { liveStats } from '../match/stats';
import { useReplay } from '../match/useReplay';
import styles from './MatchScreen.module.css';

/** The user's character: fixed to team A's first player for now. */
const MY_PLAYER = 'a1';
const FEED_SIZE = 6;

function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : 42;
}

export function MatchScreen() {
  const seed = useMemo(seedFromUrl, []);
  const log = useMemo(() => {
    const teams = generateBotMatchup(new Rng(seed), 50, 50);
    return simulateMatch({ map: MAP01, teams }, seed);
  }, [seed]);

  const { player, state } = useReplay(log);
  const ri = player.rounds[state.roundIdx] ?? player.rounds[0]!;
  const t = state.t;

  const teamNames: [string, string] = [log.teams[0].name, log.teams[1].name];
  const nickOf = useMemo(() => new Map(log.teams.flatMap((tm) => tm.players.map((p) => [p.id, p.nick] as const))), [log]);
  const teamOf = useMemo(() => new Map(log.teams.flatMap((tm, i) => tm.players.map((p) => [p.id, i as 0 | 1] as const))), [log]);
  const sideOf = (id: string): Side => (ri.start.sides.CT === teamOf.get(id) ? 'CT' : 'T');

  const feed: FeedEntry[] = ri.events
    .filter((e): e is KillEvent => isEvent(e, 'kill') && e.t <= t)
    .slice(-FEED_SIZE)
    .reverse()
    .map((kill) => ({
      kill,
      attackerNick: nickOf.get(kill.attacker) ?? kill.attacker,
      victimNick: nickOf.get(kill.victim) ?? kill.victim,
      attackerSide: sideOf(kill.attacker),
      victimSide: sideOf(kill.victim),
    }));

  const plant = ri.events.find((e) => isEvent(e, 'plant') && e.t <= t);
  const roundOver = t >= ri.end.t;
  const secondsLeft = plant ? ROUND.BOMB_TIMER - (Math.min(t, ri.end.t) - plant.t) : ROUND.TIME - Math.min(t, ri.end.t);

  const econ = useMemo(() => {
    const avg = (side: Side) => {
      const idx = ri.start.sides[side];
      const ids = log.teams[idx].players.map((p) => p.id);
      return ids.reduce((s, id) => s + (ri.start.money[id] ?? 0), 0) / ids.length;
    };
    return { CT: { avg: avg('CT'), buy: ri.start.buy.CT }, T: { avg: avg('T'), buy: ri.start.buy.T } };
  }, [ri, log]);

  const rows = useMemo(() => liveStats(log, player.rounds, state.roundIdx, roundOver ? Infinity : t), [log, player, state.roundIdx, t, roundOver]);

  const result = roundOver
    ? `${ri.end.winner} vence · ${REASON_LABEL[ri.end.reason] ?? ri.end.reason}${ri.end.clutch ? ` · clutch 1v${ri.end.clutch.vs}` : ''}${ri.end.ace ? ' · ACE' : ''}`
    : null;

  const newMatch = useCallback(() => {
    const next = Math.floor(Math.random() * 1_000_000);
    window.location.assign(`/match?seed=${next}`);
  }, []);

  return (
    <div className={styles.screen}>
      <div className={styles.headerArea}>
        <Header
          teamNames={teamNames}
          score={[ri.start.score[0], ri.start.score[1]].map((v, i) => (roundOver && ri.end.winnerTeam === i ? v + 1 : v)) as [number, number]}
          ctTeam={ri.start.sides.CT}
          round={ri.round}
          totalRounds={log.rounds.length}
          secondsLeft={secondsLeft}
          planted={Boolean(plant) && !roundOver}
          econ={econ}
          result={result}
        />
      </div>
      <div className={styles.radarArea}>
        <Radar player={player} map={MAP01} highlight={MY_PLAYER} />
        <div className={styles.controls}>
          <Controls
            state={state}
            onToggle={() => player.toggle()}
            onSpeed={(s) => player.setSpeed(s)}
            onNextRound={() => player.nextRound()}
            onSkipToEnd={() => player.skipToEnd()}
          />
          <span className={`${styles.meta} mono`}>seed {seed}</span>
        </div>
      </div>
      <div className={styles.feedArea}>
        <h2 className={styles.h2}>Kill feed</h2>
        <KillFeed entries={feed} />
      </div>
      <div className={styles.boardArea}>
        <Scoreboard rows={rows} teamNames={teamNames} highlight={MY_PLAYER} />
      </div>
      {state.finished && <EndScreen log={log} onReplay={() => player.restart()} onNewMatch={newMatch} />}
    </div>
  );
}
