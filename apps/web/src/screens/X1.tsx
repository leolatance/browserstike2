import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X1, simulateX1 } from '@idle-strike/engine';
import { DuelTargetGame, type DuelTargetStats } from '../minigames/duelTarget';
import { XP, attrCap, matchXp, xpForLevel, type MatchXpBreakdown } from '../progression/xp';
import { useSession } from '../store/auth';
import { currentBuild } from '../store/cards';
import { getCharacter, grantXp } from '../store/character';
import { cloudEnabled } from '../store/supabase';
import { useQuery } from '../store/useQuery';
import { listX1, saveX1, x1Badge } from '../store/x1';
import { BOT_DELTAS, x1BotConfig, type BotDelta } from '../x1/bot';
import { createInvite, fetchMyX1, type X1Kind } from '../x1/online';
import { X1View } from '../x1/X1View';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';

interface Done {
  score: [number, number];
  won: boolean;
  duels: number;
  opponent: string;
  xp: MatchXpBreakdown;
  levelTo: number;
  xpNow: number;
  reached: number[];
  mini: DuelTargetStats;
}

type Step = { kind: 'setup' } | { kind: 'running'; seed: number; delta: BotDelta } | ({ kind: 'done'; delta: BotDelta } & Done);

const KIND_LABEL: Record<X1Kind, { name: string; hint: string }> = {
  build: { name: 'x1 de build', hint: 'a simulação decide com atributos + build; os dois fazem o minigame em paralelo · vale Elo no ladder x1' },
  mira: { name: 'x1 de mira', hint: 'o minigame É o duelo: mesmo alvo pros dois, maior score leva a rodada · sem ladder, XP fixo' },
};

/** /x1: bot (local), friend (online, by invite) and the x1 ladder. */
export function X1Screen() {
  const nav = useNavigate();
  const { data: c } = useQuery(getCharacter);
  const { data: build } = useQuery(currentBuild);
  const { data: history } = useQuery(() => listX1(5));
  const { session } = useSession();
  const { data: myX1 } = useQuery(() => (session ? fetchMyX1() : Promise.resolve(null)), [session?.user.id]);
  const [delta, setDelta] = useState<BotDelta>(0);
  const [step, setStep] = useState<Step>({ kind: 'setup' });
  const [kind, setKind] = useState<X1Kind>('build');
  const [nick, setNick] = useState('');
  const [inviting, setInviting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const game = useMemo(() => new DuelTargetGame(), [step.kind]);
  const [miniStats, setMiniStats] = useState<DuelTargetStats | null>(null);

  const sim = useMemo(() => {
    if (step.kind !== 'running' || !c || !build) return null;
    const cfg = x1BotConfig(c, { cards: build }, step.delta, step.seed);
    return { cfg, res: simulateX1(cfg, step.seed) };
  }, [step, c, build]);

  useEffect(() => {
    if (import.meta.env.DEV && sim) (window as unknown as { __x1?: unknown }).__x1 = { ...sim, game };
  }, [sim, game]);

  const finish = useCallback(async () => {
    if (!sim || step.kind !== 'running') return;
    const { res, cfg } = sim;
    const stats = res.log.stats.find((s) => s.id === 'a1')!;
    const won = res.winner === 0;
    const mini = miniStats ?? game.stats();
    const xp = matchXp({ won, rating: stats.rating, minigameAvg: mini.accompanied ? mini.average : null, mode: 'solo', base: XP.X1_BASE });
    const next = await grantXp(xp.xp);
    await saveX1({ playedAt: Date.now(), kind: 'bot', opponent: cfg.b.nick, score: res.score, won, xp: xp.xp, minigame: mini, delta: step.delta });
    setStep({ kind: 'done', delta: step.delta, score: res.score, won, duels: res.situations.length, opponent: cfg.b.nick, xp, levelTo: next.level, xpNow: next.xp, reached: next.reached, mini });
  }, [sim, step, miniStats, game]);

  const invite = async () => {
    setInviting(true);
    setErr(null);
    try {
      const r = await createInvite(kind, nick || undefined);
      nav(`/x1/convite/${r.code}`);
    } catch (e) {
      setErr((e as Error).message === 'no_character' ? 'sua conta ainda não sincronizou o boneco' : (e as Error).message);
      setInviting(false);
    }
  };

  if (!c) return <Shell title="x1">{null}</Shell>;

  return (
    <Shell title="x1">
      <div className={ui.page}>
        {step.kind === 'setup' && (
          <>
            <section className={ui.card}>
              <span className={ui.h2}>Contra bot · local</span>
              <span className={ui.muted}>
                Primeiro a {X1.ROUNDS} duelos de mira no mid. Atributos + build contam. Minigame em todos os duelos (timing, pré-mira ou alvo). XP pela fórmula da partida com base {XP.X1_BASE}.
              </span>
              <div className={ui.grid3}>
                {BOT_DELTAS.map((d) => (
                  <button key={d.delta} aria-pressed={delta === d.delta} onClick={() => setDelta(d.delta)} title={d.hint}>
                    {d.label}
                  </button>
                ))}
              </div>
              <button className={`primary ${ui.big}`} disabled={!build} onClick={() => setStep({ kind: 'running', seed: Math.floor(Math.random() * 2 ** 31), delta })}>
                Jogar x1 contra bot
              </button>
            </section>

            <section className={ui.card}>
              <span className={ui.h2}>Contra um amigo · online</span>
              {!cloudEnabled || !session ? (
                <span className={ui.muted}>
                  precisa de conta: <Link to="/login">entrar</Link>
                </span>
              ) : (
                <>
                  <div className={ui.grid2}>
                    {(['build', 'mira'] as X1Kind[]).map((k) => (
                      <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
                        {KIND_LABEL[k].name}
                      </button>
                    ))}
                  </div>
                  <span className={ui.muted}>{KIND_LABEL[kind].hint}</span>
                  <input className={ui.input} placeholder="nick do amigo (opcional — ou mande o link)" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={16} />
                  <button className="primary" disabled={inviting} onClick={() => void invite()}>
                    {inviting ? 'criando convite…' : nick.trim() ? `Convidar ${nick.trim()}` : 'Criar convite por link'}
                  </button>
                  {err && <span className={ui.muted}>erro: {err}</span>}
                </>
              )}
            </section>

            {cloudEnabled && (
              <section className={ui.card}>
                <span className={ui.h2}>Ladder x1</span>
                <div className={ui.row}>
                  <span className={ui.muted}>{myX1 ? `você: ${myX1.elo} Elo · ${myX1.wins}/${myX1.matches}` : session ? 'sem x1 de build ainda' : 'entre pra ter Elo'}</span>
                  <Link to="/ranking?tab=x1">ver top 100 →</Link>
                </div>
              </section>
            )}

            {history && history.length > 0 && (
              <section className={ui.card}>
                <span className={ui.h2}>Últimos x1</span>
                {history.map((h) => (
                  <div key={h.id} className={ui.row}>
                    <b className={h.won ? 'ct' : 't'}>{h.won ? 'V' : 'D'}</b>
                    <span>{x1Badge(h)}</span>
                    <span className={`mono ${ui.muted}`}>+{h.xp} xp{h.eloDelta !== undefined ? ` · ${h.eloDelta >= 0 ? '+' : ''}${h.eloDelta} Elo` : ''}</span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {step.kind === 'running' && sim && <X1View log={sim.res.log} me="a1" myColor={c.color} rounds={X1.ROUNDS} game={game} onStats={setMiniStats} onFinish={() => void finish()} allowSkip />}

        {step.kind === 'done' && (
          <>
            <section className={ui.card}>
              <span className={ui.h2}>{step.won ? 'Vitória' : 'Derrota'} · x1 vs bot ({BOT_DELTAS.find((d) => d.delta === step.delta)?.label})</span>
              <div className="mono" style={{ fontSize: 30, fontWeight: 800 }}>
                {step.score[0]} – {step.score[1]} <span className={ui.muted}>vs {step.opponent}</span>
              </div>
              <div className={ui.row}>
                <span>
                  duelos <b className="mono">{step.duels}</b>
                </span>
                <span>
                  minigame <b className="mono">{step.mini.accompanied ? step.mini.average : '–'}</b> ({step.mini.accompanied}/{step.mini.total})
                </span>
              </div>
            </section>
            <section className={ui.card}>
              <span className={ui.h2}>Recompensa</span>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                +{step.xp.xp} XP
              </div>
              <span className={ui.muted}>
                {step.xp.base} × resultado {step.xp.result.toFixed(1)} × desempenho {step.xp.desempenho.toFixed(2)} × minigame {step.xp.minigame.toFixed(2)}
              </span>
              {step.reached.length > 0 ? (
                <div>
                  <b>LEVEL UP</b> → lvl {step.levelTo} · cap {attrCap(step.levelTo).toFixed(1)}
                </div>
              ) : (
                <span className={ui.muted}>
                  lvl {step.levelTo} · {step.xpNow}/{xpForLevel(step.levelTo)} xp
                </span>
              )}
            </section>
            <div className={ui.grid3}>
              <button className="primary" onClick={() => setStep({ kind: 'running', seed: Math.floor(Math.random() * 2 ** 31), delta: step.delta })}>
                Revanche
              </button>
              <button onClick={() => setStep({ kind: 'setup' })}>Outro x1</button>
              <button onClick={() => nav('/lobby')}>Lobby</button>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
