import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rng, type AttrKey, type Attrs } from '@idle-strike/engine';
import type { DuelTargetStats } from '../minigames/duelTarget';
import { TargetDrill } from '../minigames/TargetDrill';
import { DM_ATTRS, FOCUS_OPTIONS, TRAINING, dailyYield, trainingGains, trainingMinigameMult, type TrainingMode } from '../progression/training';
import { XP, attrCap } from '../progression/xp';
import { applyGains, getCharacter, grantXp } from '../store/character';
import { localDay } from '../store/db';
import { getSetting, setSetting } from '../store/settings';
import { saveSession, sessionsToday } from '../store/training';
import { useQuery } from '../store/useQuery';
import { ATTR_LABEL, AttrBars } from '../ui/AttrBars';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';

type Step = { kind: 'setup' } | { kind: 'running'; startedAt: number; focus: AttrKey } | { kind: 'done'; gains: Partial<Attrs>; stats: DuelTargetStats; attrs: Attrs; xp: number };

export function Training({ mode }: { mode: TrainingMode }) {
  const nav = useNavigate();
  const isDm = mode === 'dm';
  const title = isDm ? 'Deathmatch' : 'Treino';
  const { data: c } = useQuery(getCharacter);
  const { data: today } = useQuery(sessionsToday);
  const { data: seconds } = useQuery(() => getSetting(isDm ? 'dmSeconds' : 'treinoSeconds'), [mode]);
  const { data: sound } = useQuery(() => getSetting('sound'));
  const [focus, setFocus] = useState<AttrKey>('mira');
  const [step, setStep] = useState<Step>({ kind: 'setup' });
  const y = dailyYield(today ?? 0);

  useEffect(() => setStep({ kind: 'setup' }), [mode]);

  const finish = async (stats: DuelTargetStats, startedAt: number, chosen: AttrKey) => {
    const cur = await getCharacter();
    if (!cur) return;
    const rng = new Rng(startedAt >>> 0);
    const secondary = rng.pick(FOCUS_OPTIONS.filter((k) => k !== chosen));
    const gains = trainingGains({ mode, focus: chosen, secondary, attrs: cur.attrs, level: cur.level, minigameAverageAll: stats.averageAll, yieldFactor: y.factor });
    const attrs = await applyGains(gains);
    const xp = Math.round(XP.TRAINING * y.factor);
    await grantXp(xp);
    await saveSession({ day: localDay(), startedAt, mode, focus: isDm ? null : chosen, gains, minigameAverage: stats.averageAll, yieldLabel: y.label, xp });
    setStep({ kind: 'done', gains, stats, attrs, xp });
  };

  if (!c) return <Shell title={title}>{null}</Shell>;
  const cap = attrCap(c.level);

  return (
    <Shell title={title}>
      <div className={ui.page}>
        {step.kind === 'setup' && (
          <>
            <section className={ui.card}>
              <span className={ui.h2}>{isDm ? 'Ganho espalhado' : 'Atributo foco'}</span>
              {isDm ? (
                <div className={ui.muted}>+{TRAINING.DM_GAIN_EACH} em {DM_ATTRS.map((k) => ATTR_LABEL[k]).join(', ')} · alvos mais rápidos.</div>
              ) : (
                <div className={ui.grid2}>
                  {FOCUS_OPTIONS.map((k) => (
                    <button key={k} aria-pressed={focus === k} onClick={() => setFocus(k)}>
                      {ATTR_LABEL[k]} <span className="mono">{c.attrs[k].toFixed(1)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section className={ui.card}>
              <span className={ui.h2}>Rendimento hoje</span>
              <div className={ui.row}>
                <b className={y.label === 'alto' ? 'ct' : y.label === 'médio' ? 't' : ''}>{y.label}</b>
                <span className={ui.muted}>
                  {today ?? 0} {today === 1 ? 'sessão' : 'sessões'} hoje · sessão de {seconds ?? '…'}s
                </span>
              </div>
              <div className={ui.muted}>
                {isDm ? '' : `+${TRAINING.FOCUS_GAIN} foco / +${TRAINING.SECONDARY_GAIN} secundário`} × minigame (1,0–1,5) × rendimento × (1 − (atual/cap)²)
              </div>
            </section>
            <div className={ui.row}>
              <button aria-pressed={Boolean(sound)} onClick={() => void setSetting('sound', !sound)}>
                som: {sound ? 'ligado' : 'desligado'}
              </button>
            </div>
            <button className={`primary ${ui.big}`} disabled={!seconds} onClick={() => setStep({ kind: 'running', startedAt: Date.now(), focus })}>
              Começar
            </button>
          </>
        )}

        {step.kind === 'running' && seconds && (
          <>
            <TargetDrill
              durationSec={seconds}
              spawnMs={isDm ? TRAINING.DM_SPAWN_MS : TRAINING.TREINO_SPAWN_MS}
              visibleMs={isDm ? TRAINING.DM_VISIBLE_MS : TRAINING.TREINO_VISIBLE_MS}
              sound={Boolean(sound)}
              onFinish={(stats) => void finish(stats, step.startedAt, step.focus)}
            />
            <div className={ui.muted}>
              {isDm ? 'Deathmatch' : `Foco: ${ATTR_LABEL[step.focus]}`} · rendimento {y.label}
            </div>
          </>
        )}

        {step.kind === 'done' && (
          <>
            <section className={ui.card}>
              <span className={ui.h2}>Sessão concluída</span>
              <div className={ui.row}>
                <span>
                  média <b className="mono">{step.stats.averageAll}</b>
                </span>
                <span>
                  alvos <b className="mono">{step.stats.accompanied}/{step.stats.total}</b>
                </span>
                <span>
                  multiplicador <b className="mono">×{trainingMinigameMult(step.stats.averageAll).toFixed(2)}</b>
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
