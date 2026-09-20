import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAP01, Rng, averageAttr, simulateScenario, type AttrKey, type Attrs, type RetakeCall, type ScenarioKind, type ScenarioResult } from '@idle-strike/engine';
import { DrillView } from '../drill/DrillView';
import { CALL_LABEL, CallPrompt, LineupPrompt } from '../drill/prompts';
import { chainFor, characterPlayer, scenarioSeed } from '../drill/session';
import { DuelTargetGame } from '../minigames/duelTarget';
import { FOCUS_OPTIONS, TRAINING, dailyYield, trainingGains, trainingMinigameMult } from '../progression/training';
import { XP, attrCap } from '../progression/xp';
import { currentBuild } from '../store/cards';
import { applyGains, getCharacter, grantXp } from '../store/character';
import { localDay } from '../store/db';
import { getSetting, setSetting } from '../store/settings';
import { saveSession, sessionsToday } from '../store/training';
import { useQuery } from '../store/useQuery';
import { ATTR_LABEL, AttrBars } from '../ui/AttrBars';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';
import styles from './Training.module.css';

interface Done {
  gains: Partial<Attrs>;
  attrs: Attrs;
  xp: number;
  mult: number;
  results: ScenarioResult[];
  lineups: number[];
}

type Step = { kind: 'setup' } | { kind: 'running'; startedAt: number; focus: AttrKey; chain: ScenarioKind[] } | ({ kind: 'done' } & Done);

const TARGET_FOCUS: AttrKey[] = ['mira', 'peek', 'mov'];

/** GDD 4.1 v1: a 2-minute chain of watchable scenarios; the focus bar rises per scenario. */
export function Training() {
  const nav = useNavigate();
  const { data: c } = useQuery(getCharacter);
  const { data: today } = useQuery(sessionsToday);
  const { data: seconds } = useQuery(() => getSetting('treinoSeconds'));
  const { data: minigameOn } = useQuery(() => getSetting('minigame'));
  const { data: build } = useQuery(currentBuild);
  const [focus, setFocus] = useState<AttrKey>('mira');
  const [step, setStep] = useState<Step>({ kind: 'setup' });
  const y = dailyYield(today ?? 0);

  if (!c) return <Shell title="Treino">{null}</Shell>;
  const cap = attrCap(c.level);

  return (
    <Shell title="Treino">
      <div className={ui.page}>
        {step.kind === 'setup' && (
          <>
            <section className={ui.card}>
              <span className={ui.h2}>Atributo foco</span>
              <div className={ui.grid2}>
                {FOCUS_OPTIONS.map((k) => (
                  <button key={k} aria-pressed={focus === k} onClick={() => setFocus(k)}>
                    {ATTR_LABEL[k]} <span className="mono">{c.attrs[k].toFixed(1)}</span>
                  </button>
                ))}
              </div>
              <div className={ui.muted}>
                {seconds ? chainFor(focus, seconds).length : '…'} cenários assistidos ·{' '}
                {focus === 'tatico' ? 'você escolhe a call antes de cada retake' : focus === 'util' ? 'lineup de smoke antes de cada execute' : 'alvo de duelo opcional'}
              </div>
            </section>
            <section className={ui.card}>
              <span className={ui.h2}>Rendimento hoje</span>
              <div className={ui.row}>
                <b className={y.label === 'alto' ? 'ct' : y.label === 'médio' ? 't' : ''}>{y.label}</b>
                <span className={ui.muted}>
                  {today ?? 0} {today === 1 ? 'sessão' : 'sessões'} hoje · ~{seconds ?? '…'}s
                </span>
                {TARGET_FOCUS.includes(focus) && (
                  <button aria-pressed={Boolean(minigameOn)} onClick={() => void setSetting('minigame', !minigameOn)}>
                    minigame: {minigameOn ? 'on' : 'off'}
                  </button>
                )}
              </div>
              <div className={ui.muted}>
                +{TRAINING.FOCUS_GAIN} foco / +{TRAINING.SECONDARY_GAIN} secundário × multiplicador (1,0–1,5) × rendimento × (1 − (atual/cap)²)
              </div>
            </section>
            <button className={`primary ${ui.big}`} disabled={!seconds || !build} onClick={() => setStep({ kind: 'running', startedAt: Date.now(), focus, chain: chainFor(focus, seconds as number) })}>
              Começar
            </button>
          </>
        )}

        {step.kind === 'running' && build && (
          <ScenarioSession
            character={c}
            build={build}
            focus={step.focus}
            chain={step.chain}
            startedAt={step.startedAt}
            minigame={Boolean(minigameOn)}
            yieldFactor={y.factor}
            yieldLabel={y.label}
            onDone={(d) => setStep({ kind: 'done', ...d })}
          />
        )}

        {step.kind === 'done' && (
          <>
            <section className={ui.card}>
              <span className={ui.h2}>Sessão concluída</span>
              <div className={ui.row}>
                <span>
                  cenários <b className="mono">{step.results.filter((r) => r.won).length}/{step.results.length}</b> vencidos
                </span>
                <span>
                  multiplicador <b className="mono">×{step.mult.toFixed(2)}</b>
                </span>
                <span>
                  xp <b className="mono">+{step.xp}</b>
                </span>
              </div>
              <ul className={styles.list}>
                {step.results.map((r, i) => (
                  <li key={i} className={r.won ? styles.won : styles.lost}>
                    <b>{r.title}</b>
                    <span>
                      {r.won ? 'venceu' : 'perdeu'} · {r.duelsWon}/{r.duels} duelos · {r.timeSec}s
                      {r.call ? ` · call ${CALL_LABEL[r.call]}${r.correctCall === r.call ? ' ✓' : ` (era ${CALL_LABEL[r.correctCall as RetakeCall]})`}` : ''}
                      {step.lineups[i] !== undefined ? ` · lineup ${step.lineups[i]}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className={ui.card}>
              <span className={ui.h2}>Atributos · cap {cap.toFixed(1)}</span>
              <AttrBars attrs={step.attrs} cap={cap} deltas={step.gains} />
            </section>
            <div className={ui.grid2}>
              <button onClick={() => setStep({ kind: 'setup' })}>Outra sessão</button>
              <button className="primary" onClick={() => nav('/lobby')}>
                Lobby
              </button>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

interface SessionProps {
  character: NonNullable<Awaited<ReturnType<typeof getCharacter>>>;
  build: { id: string; level: 1 | 2 | 3 }[];
  focus: AttrKey;
  chain: ScenarioKind[];
  startedAt: number;
  minigame: boolean;
  yieldFactor: number;
  yieldLabel: string;
  onDone: (d: Done) => void;
}

type Phase = { kind: 'prompt' } | { kind: 'play'; result: ScenarioResult } | { kind: 'reveal'; result: ScenarioResult };

function ScenarioSession({ character, build, focus, chain, startedAt, minigame, yieldFactor, yieldLabel, onDone }: SessionProps) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'prompt' });
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [lineups, setLineups] = useState<number[]>([]);
  const [attrs, setAttrs] = useState<Attrs>(character.attrs);
  const [gained, setGained] = useState(0);
  const game = useMemo(() => new DuelTargetGame(), []);
  const finished = useRef(false);
  const me = useMemo(() => characterPlayer(character, { cards: build }), [character, build]);
  const cfg = useMemo(() => ({ map: MAP01, me, botAvg: averageAttr(character.attrs) }), [me, character.attrs]);
  const secondary = useMemo(() => new Rng(startedAt >>> 0).pick(FOCUS_OPTIONS.filter((k) => k !== focus)), [startedAt, focus]);
  // Base gain for the whole session at ×1.0, split evenly per scenario.
  const base = useMemo(
    () => trainingGains({ mode: 'treino', focus, secondary, attrs: character.attrs, level: character.level, minigameAverageAll: 0, yieldFactor }),
    [focus, secondary, character, yieldFactor],
  );
  const kind = chain[idx] as ScenarioKind;
  const needsCall = focus === 'tatico' && kind.startsWith('retake');
  const needsLineup = focus === 'util' && kind === 'execute';
  const useTarget = minigame && TARGET_FOCUS.includes(focus);

  const start = useCallback(
    (call?: RetakeCall, lineup?: number) => {
      const result = simulateScenario(kind, cfg, scenarioSeed(startedAt, idx), call);
      if (lineup !== undefined) setLineups((l) => [...l, lineup]);
      setPhase({ kind: 'play', result });
    },
    [kind, cfg, startedAt, idx],
  );

  // Scenarios without a prompt start immediately.
  useEffect(() => {
    if (phase.kind === 'prompt' && !needsCall && !needsLineup) start();
  }, [phase.kind, needsCall, needsLineup, start]);

  const advance = useCallback(async (r: ScenarioResult) => {
    const nextResults = [...results, r];
    setResults(nextResults);
    // Per-scenario slice of the base gain.
    const slice: Partial<Attrs> = {};
    for (const [k, v] of Object.entries(base) as [keyof Attrs, number][]) slice[k] = Math.round((v / chain.length) * 100) / 100;
    const next = await applyGains(slice);
    setAttrs(next);
    setGained((g) => g + (slice[focus] ?? 0));
    if (idx + 1 < chain.length) {
      setIdx(idx + 1);
      setPhase({ kind: 'prompt' });
      return;
    }
    if (finished.current) return;
    finished.current = true;
    // Multiplier by focus: target minigame, calls, or lineups.
    let mult = 1;
    if (useTarget) {
      const s = game.stats();
      if (s.total > 0) mult = trainingMinigameMult(s.averageAll);
    } else if (focus === 'tatico') {
      const retakes = nextResults.filter((x) => x.call);
      if (retakes.length) mult = 1 + (TRAINING.MINIGAME_MAX - 1) * (retakes.filter((x) => x.call === x.correctCall).length / retakes.length);
    } else if (focus === 'util' && lineups.length) {
      mult = trainingMinigameMult(lineups.reduce((s, v) => s + v, 0) / lineups.length);
    }
    const bonus: Partial<Attrs> = {};
    for (const [k, v] of Object.entries(base) as [keyof Attrs, number][]) bonus[k] = Math.round(v * (mult - 1) * 100) / 100;
    const finalAttrs = mult > 1 ? await applyGains(bonus) : next;
    const gains: Partial<Attrs> = {};
    for (const k of Object.keys(base) as (keyof Attrs)[]) gains[k] = Math.round((finalAttrs[k] - character.attrs[k]) * 100) / 100;
    const xp = Math.round(XP.TRAINING * yieldFactor);
    await grantXp(xp);
    const miniAvg = useTarget ? game.stats().averageAll : focus === 'util' && lineups.length ? lineups.reduce((s, v) => s + v, 0) / lineups.length : Math.round((mult - 1) * 200);
    await saveSession({ day: localDay(), startedAt, mode: 'treino', focus, gains, minigameAverage: Math.round(miniAvg), yieldLabel, xp });
    onDone({ gains, attrs: finalAttrs, xp, mult, results: nextResults, lineups });
  }, [results, base, chain.length, idx, focus, useTarget, game, lineups, character.attrs, yieldFactor, yieldLabel, startedAt, onDone]);

  // Retakes reveal the real setup for 2s before moving on.
  const onScenarioFinish = useCallback(() => {
    if (phase.kind !== 'play') return;
    const r = phase.result;
    if (r.setupAreas) setPhase({ kind: 'reveal', result: r });
    else void advance(r);
  }, [phase, advance]);
  useEffect(() => {
    if (phase.kind !== 'reveal') return;
    const id = setTimeout(() => void advance(phase.result), 2000);
    return () => clearTimeout(id);
  }, [phase, advance]);

  const title = `${phase.kind !== 'prompt' ? phase.result.title : ''} · ${idx + 1}/${chain.length}`;
  const cap = attrCap(character.level);

  if (phase.kind === 'prompt') {
    return (
      <div className={styles.center}>
        {needsCall && <CallPrompt title={`${idx + 1}/${chain.length} · ${kind === 'retake2v2' ? 'Retake B 2v2' : 'Retake A 3v2'}`} onPick={(call) => start(call)} />}
        {needsLineup && <LineupPrompt site="A" onDone={(score) => start(undefined, score)} />}
        {!needsCall && !needsLineup && <div className={ui.muted}>preparando…</div>}
      </div>
    );
  }

  const reveal = phase.kind === 'reveal' && phase.result.setupAreas ? phase.result.setupAreas.map((s, i) => ({ area: s.area, label: i === 0 ? `setup: ${CALL_LABEL[phase.result.correctCall as RetakeCall]}` : undefined })) : undefined;
  return (
    <DrillView
      key={idx}
      myColor={character.color}
      ghosts={reveal}
      log={phase.result.log}
      me="a1"
      title={title}
      subtitle={phase.result.call ? `call: ${CALL_LABEL[phase.result.call]}` : undefined}
      minigame={useTarget}
      game={game}
      onFinish={onScenarioFinish}
      focus={{ label: ATTR_LABEL[focus], value: attrs[focus], cap, gained }}
      showKills={false}
      overlay={reveal ? <div className={styles.reveal}>setup: {CALL_LABEL[phase.result.correctCall as RetakeCall]}</div> : undefined}
    />
  );
}
