import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAP01, averageAttr, simulateDeathmatch, type Attrs } from '@idle-strike/engine';
import { DrillView } from '../drill/DrillView';
import { characterPlayer, dmTeams } from '../drill/session';
import { DuelTargetGame, type DuelTargetStats } from '../minigames/duelTarget';
import { DM_ATTRS, TRAINING, dailyYield, trainingGains, trainingMinigameMult } from '../progression/training';
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

type Step =
  | { kind: 'setup' }
  | { kind: 'running'; startedAt: number; seed: number }
  | { kind: 'done'; gains: Partial<Attrs>; attrs: Attrs; xp: number; kills: number; mult: number; miniAvg: number | null };

/** GDD 4.2 v1: a watchable 3-minute team deathmatch; the bars rise per kill. */
export function Deathmatch() {
  const nav = useNavigate();
  const { data: c } = useQuery(getCharacter);
  const { data: today } = useQuery(sessionsToday);
  const { data: seconds } = useQuery(() => getSetting('dmSeconds'));
  const { data: minigameOn } = useQuery(() => getSetting('minigame'));
  const { data: build } = useQuery(currentBuild);
  const [step, setStep] = useState<Step>({ kind: 'setup' });
  const [kills, setKills] = useState(0);
  const y = dailyYield(today ?? 0);
  const game = useMemo(() => new DuelTargetGame(), [step.kind]);
  const [miniStats, setMiniStats] = useState<DuelTargetStats | null>(null);

  const session = useMemo(() => {
    if (step.kind !== 'running' || !c || !build || !seconds) return null;
    const me = characterPlayer(c, { cards: build });
    const teams = dmTeams(me, averageAttr(c.attrs), step.seed);
    const log = simulateDeathmatch({ map: MAP01, teams }, step.seed, seconds);
    const myKills = log.stats.find((s) => s.id === 'a1')?.kills ?? 0;
    const base = trainingGains({ mode: 'dm', focus: 'mira', secondary: 'peek', attrs: c.attrs, level: c.level, minigameAverageAll: 0, yieldFactor: y.factor });
    return { log, myKills, base };
  }, [step, c, build, seconds, y.factor]);

  const finish = useCallback(async () => {
    if (!session || step.kind !== 'running') return;
    const cur = await getCharacter();
    if (!cur) return;
    const stats = miniStats ?? game.stats();
    const played = minigameOn && stats.total > 0;
    const mult = played ? trainingMinigameMult(stats.averageAll) : 1;
    const gains: Partial<Attrs> = {};
    for (const [k, v] of Object.entries(session.base) as [keyof Attrs, number][]) gains[k] = Math.round(v * mult * 100) / 100;
    const attrs = await applyGains(gains);
    const xp = Math.round(XP.TRAINING * y.factor);
    await grantXp(xp);
    await saveSession({ day: localDay(), startedAt: step.startedAt, mode: 'dm', focus: null, gains, minigameAverage: played ? stats.averageAll : 0, yieldLabel: y.label, xp });
    setStep({ kind: 'done', gains, attrs, xp, kills: session.myKills, mult, miniAvg: played ? stats.averageAll : null });
  }, [session, step, miniStats, game, minigameOn, y]);

  if (!c) return <Shell title="Deathmatch">{null}</Shell>;
  const cap = attrCap(c.level);
  const baseTotal = session ? Object.values(session.base).reduce((s, v) => s + (v ?? 0), 0) : 0;
  const perKill = session && session.myKills > 0 ? baseTotal / session.myKills : 0;

  return (
    <Shell title="Deathmatch">
      <div className={ui.page}>
        {step.kind === 'setup' && (
          <>
            <section className={ui.card}>
              <span className={ui.h2}>Deathmatch 5x5 · {seconds ?? '…'}s</span>
              <div className={ui.muted}>
                Partida assistida com respawn. Ganho de +{TRAINING.DM_GAIN_EACH} em {DM_ATTRS.map((k) => ATTR_LABEL[k]).join(', ')} × minigame (1,0–1,5) × rendimento × (1 − (atual/cap)²), distribuído por kill.
              </div>
            </section>
            <section className={ui.card}>
              <span className={ui.h2}>Rendimento hoje</span>
              <div className={ui.row}>
                <b className={y.label === 'alto' ? 'ct' : y.label === 'médio' ? 't' : ''}>{y.label}</b>
                <span className={ui.muted}>{today ?? 0} sessões hoje</span>
                <button aria-pressed={Boolean(minigameOn)} onClick={() => void setSetting('minigame', !minigameOn)}>
                  minigame: {minigameOn ? 'on' : 'off'}
                </button>
              </div>
            </section>
            <button className={`primary ${ui.big}`} disabled={!seconds || !build} onClick={() => setStep({ kind: 'running', startedAt: Date.now(), seed: Math.floor(Math.random() * 2 ** 31) })}>
              Entrar no DM
            </button>
          </>
        )}

        {step.kind === 'running' && session && (
          <DrillView
            log={session.log}
            myColor={c.color}
            me="a1"
            title="Deathmatch"
            subtitle={`${session.myKills} kills no total · ganho por kill +${perKill.toFixed(2)}`}
            minigame={Boolean(minigameOn)}
            game={game}
            onMiniStats={setMiniStats}
            onMyKills={setKills}
            onFinish={() => void finish()}
            focus={{ label: 'Mira · Peek · Mov (cada)', value: c.attrs.mira + (perKill * kills) / 3, cap, gained: (perKill * kills) / 3 }}
          />
        )}

        {step.kind === 'done' && (
          <>
            <section className={ui.card}>
              <span className={ui.h2}>Sessão concluída</span>
              <div className={ui.row}>
                <span>
                  kills <b className="mono">{step.kills}</b>
                </span>
                <span>
                  minigame <b className="mono">{step.miniAvg === null ? 'off' : step.miniAvg}</b>
                </span>
                <span>
                  multiplicador <b className="mono">×{step.mult.toFixed(2)}</b>
                </span>
                <span>
                  xp <b className="mono">+{step.xp}</b>
                </span>
              </div>
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
