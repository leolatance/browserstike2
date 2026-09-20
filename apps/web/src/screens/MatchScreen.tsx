import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MAP01,
  Rng,
  ROUND,
  generateBotMatchup,
  isEvent,
  simulateMatch,
  type BuyEvent,
  type KillEvent,
  type Side,
} from '@idle-strike/engine';
import { Controls } from '../match/Controls';
import { EndScreen } from '../match/EndScreen';
import { Header } from '../match/Header';
import { KillFeed, type FeedEntry } from '../match/KillFeed';
import { Loadout } from '../match/Loadout';
import { Radar } from '../match/Radar';
import { Scoreboard } from '../match/Scoreboard';
import { CT_SETUP_LABEL, REASON_LABEL, T_CALL_LABEL } from '../match/format';
import { liveStats } from '../match/stats';
import { useReplay } from '../match/useReplay';
import { DuelTargetGame, type DuelTargetStats } from '../minigames/duelTarget';
import { getMatch, saveMatch } from '../store/matches';
import { getCharacter } from '../store/character';
import { getOutcome, peekPendingMatch, setOutcome, setPendingMatch, type MatchSource } from '../store/pending';
import { getSetting, setSetting } from '../store/settings';
import { colorScheme, type ViewMode } from '../match/colors';
import { colorFromNick, type PlayerColor } from '../store/db';
import { Avatar } from '../ui/Avatar';
import { classWithSetLabel } from '../store/buildLabel';
import { DuelTargetPanel } from '../minigames/DuelTargetPanel';
import styles from './MatchScreen.module.css';

const FEED_SIZE = 6;
/** Seconds of action during which the call label stays in the header. */
const CALL_LABEL_SECONDS = 15;

function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : 42;
}

/** Where the match comes from: the queue hand-off, a saved match (?replay=id) or a dev seed (?seed=n). */
function useMatchSource(): MatchSource | null {
  const [source, setSource] = useState<MatchSource | null>(null);
  useEffect(() => {
    const pending = peekPendingMatch();
    if (pending) {
      setSource(pending);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const replay = params.get('replay');
    if (replay) {
      getMatch(Number(replay)).then((m) => {
        if (!m) return setSource(devSource(seedFromUrl()));
        setSource({ kind: 'replay', seed: m.seed, config: m.config, myId: m.myId, myTeam: m.myTeam, matchId: m.id as number });
      });
      return;
    }
    // Same tab, refreshed after finishing: keep showing the last outcome's match.
    const last = getOutcome();
    if (last) {
      setSource({ ...last.source, kind: last.source.kind === 'queue' ? 'replay' : last.source.kind });
      return;
    }
    setSource(devSource(seedFromUrl()));
  }, []);
  return source;
}

function devSource(seed: number): MatchSource {
  const teams = generateBotMatchup(new Rng(seed), 50, 50);
  return { kind: 'dev', seed, config: { mapId: MAP01.id, teams, startingCT: 0 }, myId: 'a1', myTeam: 0 };
}

export function MatchScreen() {
  const source = useMatchSource();
  if (!source) return <div style={{ padding: 16, color: 'var(--text-2)' }}>carregando partida…</div>;
  return <MatchView source={source} />;
}

function MatchView({ source }: { source: MatchSource }) {
  const nav = useNavigate();
  const seed = source.seed;
  const MY_PLAYER = source.myId;
  const log = useMemo(() => simulateMatch({ map: MAP01, teams: source.config.teams, startingCT: source.config.startingCT }, seed), [source, seed]);

  const { player, state } = useReplay(log);
  // Dev-only hook so the log can be inspected from the browser console.
  const ri = player.rounds[state.roundIdx] ?? player.rounds[0]!;

  // Radar colours: player view by default in a queue match, HLTV in replays/dev.
  const [viewMode, setViewMode] = useState<ViewMode>(source.kind === 'queue' || source.kind === 'online' ? 'player' : 'hltv');
  const [profile, setProfile] = useState<{ color: PlayerColor; photo: Blob | null; nick: string } | null>(null);
  useEffect(() => {
    getCharacter().then((c) => c && setProfile({ color: c.color ?? colorFromNick(c.nick), photo: c.photo ?? null, nick: c.nick }));
  }, []);
  const scheme = useMemo(
    () => colorScheme(log, viewMode, MY_PLAYER, source.myTeam, profile?.color ?? 'yellow', ri.start.sides),
    [log, viewMode, MY_PLAYER, source.myTeam, profile, ri.start.sides],
  );
  const t = state.t;
  const freezeEnd = ri.start.freezetimeEnd;
  const inFreezetime = t < freezeEnd;
  const roundOver = t >= ri.end.t;

  // Minigame toggle is persisted in settings; the game itself lives in memory.
  const [minigameOn, setMinigameOnState] = useState(true);
  useEffect(() => {
    getSetting('minigame').then(setMinigameOnState);
  }, []);
  const setMinigameOn = (v: boolean) => {
    setMinigameOnState(v);
    void setSetting('minigame', v);
  };
  const game = useMemo(() => new DuelTargetGame(), [log]);
  const [miniStats, setMiniStats] = useState<DuelTargetStats | null>(null);
  const onMiniStats = useCallback((s: DuelTargetStats) => setMiniStats(s), []);

  // Hand the finished match to /resultado (queue) — never rewards a replay.
  useEffect(() => {
    if (!state.finished) return;
    if (source.kind === 'queue' || source.kind === 'online') setOutcome({ source, log, minigame: minigameOn ? game.stats() : null });
  }, [state.finished, source, log, minigameOn, game]);
  // Dev-only hook so the log can be inspected from the browser console.
  if (import.meta.env.DEV) (window as unknown as { __match?: unknown }).__match = { log, player, game };

  const teamNames: [string, string] = [log.teams[0].name, log.teams[1].name];
  const nickOf = useMemo(() => new Map(log.teams.flatMap((tm) => tm.players.map((p) => [p.id, p.nick] as const))), [log]);
  const teamOf = useMemo(() => new Map(log.teams.flatMap((tm, i) => tm.players.map((p) => [p.id, i as 0 | 1] as const))), [log]);
  const sideOf = (id: string): Side => (ri.start.sides.CT === teamOf.get(id) ? 'CT' : 'T');

  const feed: FeedEntry[] = ri.events
    .filter((e): e is KillEvent => isEvent(e, 'kill') && e.t <= t)
    .slice(-FEED_SIZE)
    .reverse()
    .map((kill) => {
      const assist = ri.events.find((e) => isEvent(e, 'assist') && e.victim === kill.victim && e.t === kill.t);
      const flashAssist = ri.events.find((e) => isEvent(e, 'flashAssist') && e.victim === kill.victim && e.t === kill.t);
      const entry: FeedEntry = {
        kill,
        attackerNick: nickOf.get(kill.attacker) ?? kill.attacker,
        victimNick: nickOf.get(kill.victim) ?? kill.victim,
        attackerSide: sideOf(kill.attacker),
        victimSide: sideOf(kill.victim),
        attackerColor: scheme.of(kill.attacker),
        victimColor: scheme.of(kill.victim),
      };
      if (assist && isEvent(assist, 'assist')) entry.assist = nickOf.get(assist.player) ?? assist.player;
      if (flashAssist && isEvent(flashAssist, 'flashAssist')) entry.flashAssist = nickOf.get(flashAssist.player) ?? flashAssist.player;
      return entry;
    });

  const plant = ri.events.find((e) => isEvent(e, 'plant') && e.t <= t);
  const clockT = Math.min(t, ri.end.t);
  const secondsLeft = plant ? ROUND.BOMB_TIMER - (clockT - plant.t) : ROUND.TIME - Math.max(0, clockT - freezeEnd);

  // Defuse progress: latest defuseStart not yet cancelled/finished.
  let defuse: { progress: number; kit: boolean } | null = null;
  if (!roundOver) {
    for (const e of ri.events) {
      if (e.t > t) break;
      if (isEvent(e, 'defuseStart')) defuse = { progress: Math.min(1, (t - e.t) / e.duration), kit: e.hasKit };
      else if (isEvent(e, 'defuseCancel') || isEvent(e, 'defuse')) defuse = null;
    }
  }

  let notice: string | null = null;
  if (!roundOver) {
    for (const e of ri.events) {
      if (e.t > t) break;
      if (isEvent(e, 'defuseCancel') && t - e.t < 3) notice = 'defuse interrompido';
    }
  }

  const callLabel = useMemo(() => {
    const calls = ri.events.filter((e) => isEvent(e, 'call'));
    const tc = calls.find((c) => isEvent(c, 'call') && c.side === 'T');
    const cc = calls.find((c) => isEvent(c, 'call') && c.side === 'CT');
    if (!tc || !cc || !isEvent(tc, 'call') || !isEvent(cc, 'call')) return null;
    return `T ${T_CALL_LABEL[tc.call] ?? tc.call} · CT ${CT_SETUP_LABEL[cc.call] ?? cc.call}`;
  }, [ri]);
  const showCall = t >= freezeEnd && t < freezeEnd + CALL_LABEL_SECONDS;

  const loadout = useMemo(
    () =>
      ri.events
        .filter((e): e is BuyEvent => isEvent(e, 'buy'))
        .map((buy) => ({ buy, nick: nickOf.get(buy.player) ?? buy.player, side: sideOf(buy.player) }))
        .sort((a, b) => (a.side === b.side ? 0 : a.side === 'CT' ? -1 : 1)),
    [ri, nickOf],
  );

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

  const leave = useCallback(() => {
    if (source.kind === 'queue') nav('/resultado');
    else if (source.kind === 'online') nav('/resultado-online');
    else if (source.kind === 'replay') nav('/perfil');
    else window.location.assign(`/match?seed=${Math.floor(Math.random() * 1_000_000)}`);
  }, [source.kind, nav]);
  const leaveLabel = source.kind === 'queue' || source.kind === 'online' ? 'Ver resultado' : source.kind === 'replay' ? 'Voltar ao perfil' : 'Nova partida';

  // "sair": a queue match left early counts as a loss with rating 0 and no XP.
  const exit = useCallback(async () => {
    player.pause();
    if (source.kind === 'queue' && !state.finished) {
      const c = await getCharacter();
      const other: 0 | 1 = source.myTeam === 0 ? 1 : 0;
      const zero = log.stats.find((s) => s.id === source.myId)!;
      if (c) {
        await saveMatch({
          playedAt: Date.now(),
          seed: source.seed,
          config: source.config,
          score: log.score,
          winner: other,
          myTeam: source.myTeam,
          myId: source.myId,
          stats: { ...zero, kills: 0, deaths: 0, assists: 0, damage: 0, kastRounds: 0, headshots: 0, rating: 0, adr: 0, kast: 0 },
          rating: 0,
          rewards: { xp: 0, minigame: null, levelFrom: c.level, levelTo: c.level },
          abandoned: true,
        });
      }
      setPendingMatch(null);
      setOutcome(null);
    }
    if (source.kind === 'queue' && state.finished) {
      nav('/resultado');
      return;
    }
    if (source.kind === 'online') {
      // Already settled on the server: leaving only skips the replay.
      setOutcome({ source, log, minigame: null });
      nav('/resultado-online');
      return;
    }
    nav('/lobby');
  }, [player, source, state.finished, log, nav]);
  const exitLabel = source.kind === 'queue' ? 'Sair (conta como derrota)' : source.kind === 'online' ? 'Pular pro resultado' : 'Fechar';

  return (
    <div className={styles.screen}>
      <div className={styles.headerArea}>
        <Header
          teamNames={teamNames}
          score={[ri.start.score[0], ri.start.score[1]].map((v, i) => (roundOver && ri.end.winnerTeam === i ? v + 1 : v)) as [number, number]}
          ctTeam={ri.start.sides.CT}
          roundLabel={ri.round > 2 * log.mr ? `OT ${ri.round - 2 * log.mr}` : `round ${ri.round}`}
          secondsLeft={secondsLeft}
          planted={Boolean(plant) && !roundOver}
          econ={econ}
          result={result}
          callLabel={showCall ? callLabel : null}
          defuse={defuse}
          minigame={{ enabled: minigameOn, onToggle: () => setMinigameOn(!minigameOn) }}
          notice={notice}
          view={{ mode: viewMode, onToggle: () => setViewMode((m) => (m === 'player' ? 'hltv' : 'player')) }}
        />
      </div>
      <div className={styles.radarArea}>
        <div className={styles.radarWrap}>
          <Radar player={player} map={MAP01} highlight={MY_PLAYER} scheme={scheme} />
          {inFreezetime && <Loadout rows={loadout} secondsLeft={freezeEnd - t} />}
        </div>
        <div className={styles.controls}>
          <Controls
            state={state}
            onToggle={() => player.toggle()}
            onSpeed={(s) => player.setSpeed(s)}
            onNextRound={() => player.nextRound()}
            onSkipToEnd={() => player.skipToEnd()}
            onExit={() => void exit()}
            exitLabel={exitLabel}
          />
          <span className={`${styles.meta} mono`}>
            {source.kind === 'replay' ? 'replay · ' : ''}seed {seed}
          </span>
        </div>
      </div>
      {minigameOn && (
        <div className={styles.miniArea}>
          <DuelTargetPanel player={player} me={MY_PLAYER} team={log.teams[teamOf.get(MY_PLAYER) ?? 0].players.map((p) => p.id)} game={game} speed={state.speed} onStats={onMiniStats} />
        </div>
      )}
      <div className={styles.feedArea}>
        <h2 className={styles.h2}>Kill feed</h2>
        <KillFeed entries={feed} />
      </div>
      <div className={styles.boardArea}>
        <Scoreboard
          rows={rows}
          teamNames={teamNames}
          highlight={MY_PLAYER}
          colorOf={scheme.of}
          myClassLabel={source.kind !== 'dev' ? classWithSetLabel(source.config.teams[source.myTeam].players.find((p) => p.id === MY_PLAYER)?.build ?? { cards: [] }) : undefined}
          avatar={source.kind !== 'dev' && profile ? <span style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}><Avatar photo={profile.photo} nick={profile.nick} size={18} /></span> : undefined}
        />
      </div>
      {state.finished && (
        <EndScreen
          log={log}
          minigame={minigameOn ? (miniStats ?? game.stats()) : null}
          leaveLabel={leaveLabel}
          onReplay={() => {
            game.reset();
            setMiniStats(null);
            player.restart();
          }}
          onLeave={leave}
        />
      )}
    </div>
  );
}
